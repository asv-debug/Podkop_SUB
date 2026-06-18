#!/bin/sh

REPO="https://api.github.com/repos/asv-debug/Podkop_SUB/releases/latest"
LATEST_DOWNLOAD_BASE="https://github.com/asv-debug/Podkop_SUB/releases/latest/download"
CDN_REF="${PODKOP_SUBSCRIPTIONS_CDN_REF:-10fae07}"
CDN_DOWNLOAD_BASE="https://cdn.jsdelivr.net/gh/asv-debug/Podkop_SUB@$CDN_REF/packages"
RAW_DOWNLOAD_BASE="https://raw.githubusercontent.com/asv-debug/Podkop_SUB/main/packages"
DOWNLOAD_DIR="/tmp/podkop-subscriptions"
PKG_NAME="podkop-subscriptions"
COUNT=3

PKG_IS_APK=0
command -v apk >/dev/null 2>&1 && PKG_IS_APK=1

msg() {
    printf "\033[32;1m%s\033[0m\n" "$1"
}

fail() {
    printf "\033[31;1m%s\033[0m\n" "$1" >&2
    exit 1
}

check_podkop_installed() {
    [ -x /usr/bin/podkop ] || fail "Podkop is not installed: /usr/bin/podkop not found"
    [ -f /usr/lib/podkop/helpers.sh ] || fail "Podkop helpers are not installed: /usr/lib/podkop/helpers.sh not found"
    [ -f /www/luci-static/resources/view/podkop/section.js ] ||
        fail "luci-app-podkop is not installed: section.js not found"
    [ -f /www/luci-static/resources/view/podkop/podkop.js ] ||
        fail "luci-app-podkop is not installed: podkop.js not found"
}

pkg_install() {
    local pkg_file="$1"

    if [ "$PKG_IS_APK" -eq 1 ]; then
        local pkg_dir pkg_base
        pkg_dir="${pkg_file%/*}"
        pkg_base="${pkg_file##*/}"

        (
            cd "$pkg_dir" &&
                apk add --allow-untrusted --repositories-file /dev/null "./$pkg_base"
        ) || (
            cd "$pkg_dir" &&
                apk add --allow-untrusted "./$pkg_base"
        )
    else
        opkg install "$pkg_file"
    fi
}

install_runtime_dependencies() {
    local missing dependency

    missing=""
    for dependency in curl jq; do
        command -v "$dependency" >/dev/null 2>&1 || missing="$missing $dependency"
    done

    [ -n "$missing" ] || return 0

    msg "Installing runtime dependencies:$missing"
    if [ "$PKG_IS_APK" -eq 1 ]; then
        apk update >/dev/null 2>&1 || true
        apk add $missing >/dev/null 2>&1 ||
            msg "Could not pre-install runtime dependencies; package manager will try to resolve them while installing the addon."
    else
        opkg update >/dev/null 2>&1 || true
        opkg install $missing >/dev/null 2>&1 ||
            msg "Could not pre-install runtime dependencies; package manager will try to resolve them while installing the addon."
    fi
}

download_file() {
    local url="$1"
    local filepath="$2"
    local filename="$3"
    local attempt

    attempt=0
    while [ "$attempt" -lt "$COUNT" ]; do
        msg "Download $filename (attempt $((attempt + 1))/$COUNT)..."
        if wget -q -O "$filepath" "$url" && [ -s "$filepath" ]; then
            return 0
        fi
        rm -f "$filepath"
        attempt=$((attempt + 1))
        sleep 2
    done

    return 1
}

main() {
    check_podkop_installed

    rm -rf "$DOWNLOAD_DIR"
    mkdir -p "$DOWNLOAD_DIR"

    local extension grep_url_pattern
    if [ "$PKG_IS_APK" -eq 1 ]; then
        extension="apk"
    else
        extension="ipk"
    fi

    grep_url_pattern="https://[^\"[:space:]]*${PKG_NAME}[^\"[:space:]]*\\.${extension}"

    local stable_filename stable_filepath stable_url cdn_url raw_url filename filepath cache_buster
    stable_filename="${PKG_NAME}.${extension}"
    stable_filepath="$DOWNLOAD_DIR/$stable_filename"
    stable_url="$LATEST_DOWNLOAD_BASE/$stable_filename"
    raw_url="$RAW_DOWNLOAD_BASE/$stable_filename"
    cache_buster="$(date +%s 2>/dev/null || echo 0)"
    cdn_url="$CDN_DOWNLOAD_BASE/$stable_filename?v=$cache_buster"

    filename="$stable_filename"
    filepath="$stable_filepath"

    if download_file "$cdn_url" "$stable_filepath" "$stable_filename"; then
        :
    elif download_file "$raw_url" "$stable_filepath" "$stable_filename"; then
        :
    elif download_file "$stable_url" "$stable_filepath" "$stable_filename"; then
        :
    else
        local urls
        urls="$(wget -qO- "$REPO" | grep -o "$grep_url_pattern")"
        [ -n "$urls" ] || fail "No ${PKG_NAME}.${extension} asset found in latest release"

        local url
        url="$(printf "%s\n" "$urls" | head -n 1)"
        filename="$(basename "$url")"
        filepath="$DOWNLOAD_DIR/$filename"

        download_file "$url" "$filepath" "$filename" || fail "Failed to download $filename"
    fi

    install_runtime_dependencies

    msg "Installing $filename..."
    pkg_install "$filepath" || fail "Failed to install $filename"

    msg "Podkop subscriptions addon installed."
    msg "Open LuCI: Services -> Podkop -> Sections"
    msg "Select Configuration Type: Subscription, update the server list, then choose one server in Dashboard."
    msg "If LuCI still shows the old form, clear browser/LuCI cache."
}

main
