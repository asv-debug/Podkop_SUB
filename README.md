# Podkop Subscriptions Addon

Дополнение для уже установленного Podkop на OpenWrt. Добавляет в LuCI режим `Subscription URL`, который импортирует proxy-ссылки из подписки, проверяет задержку через `urltest` и позволяет выбрать сервер через существующий selector/Dashboard.

## Требования

- Установленный Podkop и luci-app-podkop.
- OpenWrt с `opkg` или `apk`.
- После установки очистите кэш LuCI/браузера, если новая форма не появилась сразу.

## Установка

```sh
wget -O - https://raw.githubusercontent.com/asv-debug/Podkop_SUB/main/install.sh | sh
```

После установки откройте LuCI: `Services -> Podkop -> Sections`, выберите `Connection Type: Proxy`, затем `Configuration Type: Subscription URL`.

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

