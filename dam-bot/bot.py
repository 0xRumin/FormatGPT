import os
import re
import time
import logging
import cloudscraper
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

load_dotenv()

BOT_TOKEN   = os.getenv("BOT_TOKEN", "")
PRICE_PER_K = float(os.getenv("PRICE_PER_K", "12"))
CACHE_TTL   = int(os.getenv("CACHE_TTL", "300"))

BASE = "https://digitalaccountmarket.com"
PAGE_SIZE = 100
MAX_PAGES = 100

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("dam-bot")

scraper = cloudscraper.create_scraper(
    browser={"browser": "chrome", "platform": "windows"},
    delay=2
)
scraper.headers.update({
    "Accept": "application/json, text/plain;q=0.9, */*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": f"{BASE}/en",
})

# ─── Cache ───────────────────────────────────────────────────────────
cache = {
    "items": {},        # username_lower -> {username, followers, formatted, price, category}
    "categories": [],   # raw category list (1K+ only)
    "updated_at": 0,
    "loading": False,
}


def fetch_categories():
    r = scraper.get(f"{BASE}/api/categories")
    r.raise_for_status()
    data = r.json()
    if not isinstance(data, list):
        raise ValueError("categories endpoint returned non-list")
    cats = []
    for c in data:
        name = (c.get("name") or "").lower().replace(",", "").replace(" ", "")
        if "1000+" in name or "1k+" in name:
            cats.append(c)
    return cats


def fetch_items(slug):
    collected = []
    seen_first = {}
    for page in range(1, MAX_PAGES + 1):
        url = f"{BASE}/api/categories/{slug}/items?page={page}&limit={PAGE_SIZE}"
        r = scraper.get(url)
        r.raise_for_status()
        j = r.json()
        items = j.get("items") or []
        if not items:
            break
        first_key = items[0].get("display", "")
        if page > 1 and first_key in seen_first.values():
            break
        seen_first[page] = first_key
        collected.extend(items)
        if len(items) < PAGE_SIZE:
            break
    return collected


def refresh_cache():
    if cache["loading"]:
        return
    cache["loading"] = True
    try:
        log.info("Refreshing DAM cache...")
        cats = fetch_categories()
        cache["categories"] = cats
        lookup = {}
        total = 0
        for cat in cats:
            slug = cat.get("slug", "")
            cat_name = cat.get("name", "")
            try:
                items = fetch_items(slug)
            except Exception as e:
                log.warning(f"Failed to fetch items for {slug}: {e}")
                continue
            for it in items:
                username = (it.get("display") or "").strip()
                if not username:
                    continue
                followers = int(it.get("followerCount") or 0)
                formatted = it.get("formattedFollowers") or ""
                if not formatted and followers:
                    formatted = f"{followers/1000:.1f}K" if followers >= 1000 else str(followers)
                price = float(it.get("price") or 0)
                key = username.lower()
                if key not in lookup or followers > lookup[key]["followers"]:
                    lookup[key] = {
                        "username": username,
                        "followers": followers,
                        "formatted": formatted,
                        "price": price,
                        "category": cat_name,
                    }
                total += 1
        cache["items"] = lookup
        cache["updated_at"] = time.time()
        log.info(f"Cache refreshed: {len(lookup)} unique accounts from {len(cats)} categories ({total} total items)")
    except Exception as e:
        log.error(f"Cache refresh failed: {e}")
    finally:
        cache["loading"] = False


def ensure_cache():
    if time.time() - cache["updated_at"] > CACHE_TTL:
        refresh_cache()


def extract_usernames(text):
    lines = text.strip().splitlines()
    usernames = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        m = re.search(r"(?:https?://)?(?:www\.)?(?:x\.com|twitter\.com)/@?([A-Za-z0-9_]+)", line, re.I)
        if m:
            usernames.append(m.group(1))
            continue
        clean = line.lstrip("@").strip()
        if re.match(r"^[A-Za-z0-9_]+$", clean):
            usernames.append(clean)
    return usernames


def check_usernames(usernames):
    ensure_cache()
    available = []
    not_available = []
    for u in usernames:
        key = u.lower()
        item = cache["items"].get(key)
        if item:
            calc_price = round((item["followers"] / 1000) * PRICE_PER_K, 2)
            available.append({
                "username": item["username"],
                "followers": item["followers"],
                "formatted": item["formatted"],
                "price": calc_price,
                "category": item["category"],
            })
        else:
            not_available.append(u)
    return available, not_available


def format_response(available, not_available, usernames):
    total = len(usernames)
    lines = []

    if available:
        lines.append(f"✅ <b>Available on DAM ({len(available)}/{total}):</b>")
        total_price = 0
        for a in sorted(available, key=lambda x: x["followers"], reverse=True):
            lines.append(f"  <code>@{a['username']}</code> — {a['formatted']} followers — <b>${a['price']:.2f}</b>")
            total_price += a["price"]
        lines.append("")
        if len(available) > 1:
            lines.append(f"💰 <b>Total: ${total_price:.2f}</b> (at ${PRICE_PER_K:.0f}/1K)")
            lines.append("")

    if not_available:
        lines.append(f"❌ <b>Not available ({len(not_available)}/{total}):</b>")
        for u in not_available:
            lines.append(f"  <code>@{u}</code>")
        lines.append("")

    cats = cache.get("categories") or []
    cat_names = [c.get("name", "") for c in cats]
    total_accounts = len(cache.get("items", {}))
    age = int(time.time() - cache.get("updated_at", 0))
    lines.append(f"<i>📊 {total_accounts} accounts indexed across {len(cats)} categories</i>")
    lines.append(f"<i>🔄 Cache age: {age}s (refreshes every {CACHE_TTL}s)</i>")

    return "\n".join(lines)


# ─── Handlers ────────────────────────────────────────────────────────

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = (
        "👋 <b>DAM Checker Bot</b>\n\n"
        "Check if X/Twitter usernames are available on "
        "<a href='https://digitalaccountmarket.com'>digitalaccountmarket.com</a> "
        "(1K+ followers categories).\n\n"
        "<b>How to use:</b>\n"
        "Send usernames — one per line. Accepts:\n"
        "• <code>username</code>\n"
        "• <code>@username</code>\n"
        "• <code>x.com/username</code>\n"
        "• <code>https://x.com/username</code>\n\n"
        f"<b>Pricing:</b> ${PRICE_PER_K:.0f} per 1K followers\n\n"
        "<b>Commands:</b>\n"
        "/start — This message\n"
        "/refresh — Force refresh the DAM cache\n"
        "/stats — Show cache stats"
    )
    await update.message.reply_text(text, parse_mode="HTML", disable_web_page_preview=True)


async def cmd_refresh(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("🔄 Refreshing DAM cache...", parse_mode="HTML")
    refresh_cache()
    total = len(cache.get("items", {}))
    cats = len(cache.get("categories", []))
    await update.message.reply_text(
        f"✅ Cache refreshed: <b>{total}</b> accounts from <b>{cats}</b> categories.",
        parse_mode="HTML"
    )


async def cmd_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    total = len(cache.get("items", {}))
    cats = cache.get("categories", [])
    age = int(time.time() - cache.get("updated_at", 0))
    lines = [
        "📊 <b>Cache Stats</b>",
        f"• Accounts indexed: <b>{total}</b>",
        f"• Categories: <b>{len(cats)}</b>",
    ]
    for c in cats:
        lines.append(f"  └ {c.get('name', '?')} ({c.get('availableCount', 0)} available)")
    lines.append(f"• Cache age: <b>{age}s</b> (TTL: {CACHE_TTL}s)")
    lines.append(f"• Price: <b>${PRICE_PER_K:.0f}/1K</b>")
    await update.message.reply_text("\n".join(lines), parse_mode="HTML")


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text or ""
    if not text.strip():
        return

    usernames = extract_usernames(text)
    if not usernames:
        await update.message.reply_text(
            "⚠️ No valid usernames found. Send usernames one per line, or paste x.com links.",
            parse_mode="HTML"
        )
        return

    deduped = list(dict.fromkeys(usernames))
    if len(deduped) > 50:
        await update.message.reply_text("⚠️ Max 50 usernames at once. Please split into batches.")
        return

    wait_msg = await update.message.reply_text(
        f"🔍 Checking {len(deduped)} username{'s' if len(deduped) > 1 else ''} against DAM...",
        parse_mode="HTML"
    )

    try:
        available, not_available = check_usernames(deduped)
        response = format_response(available, not_available, deduped)
        await wait_msg.edit_text(response, parse_mode="HTML")
    except Exception as e:
        log.error(f"Check failed: {e}")
        await wait_msg.edit_text(f"❌ Error checking DAM: <code>{e}</code>", parse_mode="HTML")


# ─── Main ────────────────────────────────────────────────────────────

def main():
    if not BOT_TOKEN:
        print("ERROR: Set BOT_TOKEN in .env file")
        return

    log.info("Starting DAM Checker Bot...")
    log.info(f"Price: ${PRICE_PER_K}/1K | Cache TTL: {CACHE_TTL}s")

    log.info("Initial cache load...")
    refresh_cache()

    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("refresh", cmd_refresh))
    app.add_handler(CommandHandler("stats", cmd_stats))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    log.info("Bot is running. Press Ctrl+C to stop.")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
