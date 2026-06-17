#!/bin/sh

REPO="https://api.github.com/repos/asv-debug/Podkop_SUB/releases/latest"
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

    local urls
    urls="$(wget -qO- "$REPO" | grep -o "$grep_url_pattern")"
    [ -n "$urls" ] || fail "No ${PKG_NAME}.${extension} asset found in latest release"

    local url
    url="$(printf "%s\n" "$urls" | head -n 1)"

    local filename filepath attempt
    filename="$(basename "$url")"
    filepath="$DOWNLOAD_DIR/$filename"

    attempt=0
    while [ "$attempt" -lt "$COUNT" ]; do
        msg "Download $filename (attempt $((attempt + 1))/$COUNT)..."
        if wget -q -O "$filepath" "$url" && [ -s "$filepath" ]; then
            break
        fi
        rm -f "$filepath"
        attempt=$((attempt + 1))
        sleep 2
    done

    [ -s "$filepath" ] || fail "Failed to download $filename"

    msg "Installing $filename..."
    pkg_install "$filepath" || fail "Failed to install $filename"

    msg "Podkop subscriptions addon installed."
    msg "Open LuCI: Services -> Podkop -> Subscriptions"
    msg "After selecting a server, restart Podkop: /etc/init.d/podkop restart"
    msg "If LuCI still shows the old form, clear browser/LuCI cache."
}

main
