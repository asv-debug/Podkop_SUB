#!/bin/sh

set -u

PAYLOAD_DIR="/usr/share/podkop-subscriptions/payload"
BACKUP_DIR="/usr/share/podkop-subscriptions/backups"

TARGET_PODKOP="/usr/bin/podkop"
TARGET_HELPERS="/usr/lib/podkop/helpers.sh"
TARGET_SECTION="/www/luci-static/resources/view/podkop/section.js"

log() {
    echo "podkop-subscriptions: $*"
}

fail() {
    log "$*" >&2
    exit 1
}

clear_luci_cache() {
    rm -rf /tmp/luci-indexcache /tmp/luci-modulecache 2>/dev/null || true
    /etc/init.d/uhttpd reload >/dev/null 2>&1 || true
}

backup_file_once() {
    local target="$1"
    local backup_name="$2"

    [ -f "$target" ] || fail "target file not found: $target"
    mkdir -p "$BACKUP_DIR"

    if [ ! -f "$BACKUP_DIR/$backup_name" ]; then
        cp -p "$target" "$BACKUP_DIR/$backup_name" || fail "failed to backup $target"
    fi
}

apply_file() {
    local payload="$1"
    local target="$2"
    local backup_name="$3"
    local mode="$4"

    [ -f "$payload" ] || fail "payload file not found: $payload"
    backup_file_once "$target" "$backup_name"
    cp "$payload" "$target" || fail "failed to install $target"
    chmod "$mode" "$target" || true
}

restore_file() {
    local target="$1"
    local backup_name="$2"
    local mode="$3"

    if [ -f "$BACKUP_DIR/$backup_name" ]; then
        cp "$BACKUP_DIR/$backup_name" "$target" || fail "failed to restore $target"
        chmod "$mode" "$target" || true
    else
        log "backup not found for $target, skipping"
    fi
}

apply_addon() {
    [ -x "$TARGET_PODKOP" ] || fail "Podkop is not installed: $TARGET_PODKOP"
    [ -f "$TARGET_HELPERS" ] || fail "Podkop helpers not found: $TARGET_HELPERS"
    [ -f "$TARGET_SECTION" ] || fail "luci-app-podkop section not found: $TARGET_SECTION"

    apply_file "$PAYLOAD_DIR/podkop" "$TARGET_PODKOP" "podkop.orig" "755"
    apply_file "$PAYLOAD_DIR/helpers.sh" "$TARGET_HELPERS" "helpers.sh.orig" "644"
    apply_file "$PAYLOAD_DIR/section.js" "$TARGET_SECTION" "section.js.orig" "644"

    clear_luci_cache
    log "subscription URL support applied"
    log "restart Podkop after changing configuration: /etc/init.d/podkop restart"
}

restore_addon() {
    restore_file "$TARGET_PODKOP" "podkop.orig" "755"
    restore_file "$TARGET_HELPERS" "helpers.sh.orig" "644"
    restore_file "$TARGET_SECTION" "section.js.orig" "644"

    clear_luci_cache
    log "original Podkop files restored where backups were available"
}

case "${1:-apply}" in
apply)
    apply_addon
    ;;
restore)
    restore_addon
    ;;
*)
    fail "usage: $0 {apply|restore}"
    ;;
esac

