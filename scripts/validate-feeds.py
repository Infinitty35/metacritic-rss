#!/usr/bin/env python3
"""Start the local server, fetch the games and TV feeds, and check the RSS."""

import subprocess
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PORT = "3999"
BASE = f"http://127.0.0.1:{PORT}"
MEDIA_NS = "http://search.yahoo.com/mrss/"
ATOM_NS = "http://www.w3.org/2005/Atom"

FEEDS = {
    "games": {
        "path": "/api/games.xml",
        "link_prefix": "https://www.metacritic.com/game/",
    },
    "tv": {
        "path": "/api/tv.xml",
        "link_prefix": "https://www.metacritic.com/tv/",
    },
}


class ValidationError(Exception):
    pass


def wait_until_ready(proc, timeout=15):
    deadline = time.time() + timeout
    last_error = None
    while time.time() < deadline:
        if proc.poll() is not None:
            raise ValidationError(f"server exited early with code {proc.returncode}")
        try:
            with urllib.request.urlopen(BASE + "/", timeout=2) as response:
                if response.status == 200:
                    return
        except Exception as error:  # noqa: BLE001 - retry until timeout
            last_error = error
            time.sleep(0.2)
    raise ValidationError(f"server did not become ready: {last_error}")


def fetch(path):
    request = urllib.request.Request(BASE + path, headers={"Accept": "application/rss+xml"})
    try:
        with urllib.request.urlopen(request, timeout=40) as response:
            body = response.read()
            return response.status, dict(response.headers.items()), body
    except urllib.error.HTTPError as error:
        body = error.read()
        return error.code, dict(error.headers.items()), body


def child_text(parent, tag):
    element = parent.find(tag)
    if element is None or element.text is None:
        return ""
    return element.text.strip()


def check_feed(name, spec, status, headers, body):
    errors = []
    if status != 200:
        errors.append(f"HTTP {status}, expected 200")

    content_type = ""
    cache_control = ""
    for key, value in headers.items():
        if key.lower() == "content-type":
            content_type = value
        if key.lower() == "cache-control":
            cache_control = value

    if "xml" not in content_type.lower():
        errors.append(f"content-type {content_type!r} is not XML")
    if "s-maxage=1800" not in cache_control:
        errors.append(f"cache-control missing s-maxage=1800: {cache_control!r}")
    if "stale-while-revalidate" not in cache_control:
        errors.append(f"cache-control missing stale-while-revalidate: {cache_control!r}")

    try:
        root = ET.fromstring(body)
    except ET.ParseError as error:
        raise ValidationError(f"{name}: XML did not parse: {error}\n{body[:500]!r}") from error

    if root.tag != "rss":
        errors.append(f"root tag is {root.tag!r}, expected rss")
    if root.attrib.get("version") != "2.0":
        errors.append(f"rss version is {root.attrib.get('version')!r}")

    channel = root.find("channel")
    if channel is None:
        raise ValidationError(f"{name}: missing channel\n" + "; ".join(errors))

    title = child_text(channel, "title")
    description = child_text(channel, "description")
    if not title:
        errors.append("channel title is empty")
    if description.startswith("This feed could not be refreshed"):
        errors.append(f"feed failed upstream: {description}")

    self_link = channel.find(f"{{{ATOM_NS}}}link")
    if self_link is None or not self_link.attrib.get("href"):
        errors.append("missing atom:link rel=self")

    items = channel.findall("item")
    if len(items) < 8:
        errors.append(f"expected at least 8 items, found {len(items)}")

    pub_dates = []
    images = 0
    metascores = 0
    long_descriptions = 0
    samples = []

    for index, item in enumerate(items, start=1):
        item_title = child_text(item, "title")
        link = child_text(item, "link")
        guid = child_text(item, "guid")
        guid_el = item.find("guid")
        pub_date = child_text(item, "pubDate")
        item_description = child_text(item, "description")
        media = item.find(f"{{{MEDIA_NS}}}content")

        if not item_title:
            errors.append(f"item {index} missing title")
        if not link.startswith(spec["link_prefix"]):
            errors.append(f"item {index} link {link!r} does not start with {spec['link_prefix']}")
        if not guid:
            errors.append(f"item {index} missing guid")
        elif guid != link:
            errors.append(f"item {index} guid does not match link")
        if guid_el is not None and guid_el.attrib.get("isPermaLink") != "true":
            errors.append(f"item {index} guid is not a permalink")
        if pub_date:
            if not pub_date.endswith("12:00:00 GMT"):
                errors.append(f"item {index} pubDate is not a stable noon-GMT release date: {pub_date}")
            try:
                parsedate_to_datetime(pub_date)
            except (TypeError, ValueError):
                errors.append(f"item {index} pubDate did not parse: {pub_date}")
            pub_dates.append(pub_date)
        if "Metascore:" in item_description:
            metascores += 1
        if len(item_description) > 80:
            long_descriptions += 1
        if media is not None and media.attrib.get("url", "").startswith("https://www.metacritic.com/"):
            images += 1
        if len(samples) < 4:
            samples.append(
                {
                    "title": item_title,
                    "link": link,
                    "pubDate": pub_date or "(none)",
                    "guid": guid,
                    "description": item_description[:280],
                }
            )

    if len(pub_dates) < 5:
        errors.append(f"expected at least 5 dated items, found {len(pub_dates)}")
    if len(set(pub_dates)) < 2:
        errors.append(f"pubDates are not distinct enough: {sorted(set(pub_dates))[:6]}")
    if metascores < 1:
        errors.append("no item description includes a Metascore")
    if images < 5:
        errors.append(f"expected at least 5 thumbnail images, found {images}")
    if long_descriptions < 1:
        errors.append("no item has a substantial description")

    return errors, samples, len(items)


def main():
    proc = subprocess.Popen(
        ["node", "server.js"],
        cwd=ROOT,
        env={**dict(**{k: v for k, v in __import__("os").environ.items()}), "PORT": PORT},
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    failures = []
    try:
        wait_until_ready(proc)
        reports = {}
        for name, spec in FEEDS.items():
            status, headers, body = fetch(spec["path"])
            try:
                errors, samples, count = check_feed(name, spec, status, headers, body)
            except ValidationError as error:
                failures.append(str(error))
                continue
            reports[name] = {"count": count, "samples": samples, "errors": errors}
            failures.extend(f"{name}: {error}" for error in errors)

        removed_status, _removed_headers, _removed_body = fetch("/api/all.xml")
        if removed_status != 404:
            failures.append(f"combined feed /api/all.xml returned HTTP {removed_status}, expected 404")

        for name, report in reports.items():
            print(f"\n{name}: {report['count']} items")
            for sample in report["samples"]:
                print(f"- {sample['title']}")
                print(f"  link: {sample['link']}")
                print(f"  pubDate: {sample['pubDate']}")
                print(f"  guid: {sample['guid']}")
                print(f"  description: {sample['description']}")

        if failures:
            print("\nValidation failed:", file=sys.stderr)
            for failure in failures:
                print(f"- {failure}", file=sys.stderr)
            return 1

        print("\nBoth feeds are valid RSS 2.0 with current Metacritic items.")
        return 0
    except ValidationError as error:
        print(f"Validation failed: {error}", file=sys.stderr)
        return 1
    finally:
        proc.terminate()
        try:
            output, _ = proc.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            output, _ = proc.communicate(timeout=5)
        if output and failures:
            print("\nServer log:\n" + output[-4000:], file=sys.stderr)


if __name__ == "__main__":
    sys.exit(main())
