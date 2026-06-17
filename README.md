# Podkop Subscriptions Addon

Дополнение для уже установленного Podkop на OpenWrt. Добавляет в LuCI режим `Subscription URL`, который импортирует proxy-ссылки из подписки, проверяет задержку через `urltest` и позволяет выбрать сервер через существующий selector/Dashboard.

Поддерживает обычные client subscription endpoints для Happ/Hiddify/v2rayN/v2rayNG/NekoBox/Clash Meta/sing-box: addon пробует несколько User-Agent, понимает plain/base64/base64url списки, а также JSON/YAML-обертки с proxy-ссылками или base64-полями.

Если сам роутер не может скачать URL подписки из-за DNS/маршрутизации, заполните поле `Subscription Content`: туда можно вставить ответ подписки или сами `vless://`, `ss://`, `trojan://`, `socks4://`, `socks5://`, `hy2://` ссылки. После первой успешной загрузки addon сохраняет рабочий список в `/etc/podkop-subscriptions/cache/` и использует его, если очередное обновление подписки временно недоступно.

## Требования

- Установленный Podkop и luci-app-podkop.
- OpenWrt с `opkg` или `apk`.
- После установки очистите кэш LuCI/браузера, если новая форма не появилась сразу.

## Установка

```sh
wget -O - https://raw.githubusercontent.com/asv-debug/Podkop_SUB/main/install.sh | sh
```

После установки откройте LuCI: `Services -> Podkop -> Sections`, выберите `Connection Type: Proxy`, затем `Configuration Type: Subscription URL`.

Если провайдер требует конкретный клиентский User-Agent, укажите его в поле `Subscription User-Agent`. Для Happ обычно подходит:

```text
Happ/1.0
```

Автообновление подписки настраивается в той же секции: каждый час, каждый день в выбранное время или каждую неделю в выбранный день и время.

Если URL подписки не открывается с OpenWrt, но открывается с телефона/ПК, скопируйте содержимое ответа и вставьте его в `Subscription Content`. В этом режиме URL можно оставить пустым.

## Что делает пакет

- Создает backup исходных файлов Podkop.
- Обновляет `/usr/bin/podkop`.
- Обновляет `/usr/lib/podkop/helpers.sh`.
- Обновляет `/www/luci-static/resources/view/podkop/section.js`.
- Не заменяет весь Podkop и не трогает текущий `/etc/config/podkop`.

## Удаление

```sh
opkg remove podkop-subscriptions
```

или для APK-based OpenWrt:

```sh
apk del podkop-subscriptions
```

При удалении пакет пытается восстановить файлы из backup.
