# Podkop Subscriptions Addon

Дополнение для уже установленного Podkop на OpenWrt. Пакет добавляет отдельную вкладку `Подписки` в LuCI Podkop и не меняет логику запуска Podkop/Sing-box.

Во вкладке можно вставить URL подписки, загрузить список серверов, проверить ping хоста и выбрать нужный сервер. Выбранный сервер сохраняется в выбранную секцию Podkop как обычная proxy-ссылка:

- `connection_type=proxy`
- `proxy_config_type=url`
- `proxy_string=<selected proxy link>`

Так Podkop продолжает работать штатно: если подписка временно недоступна или провайдер отдает неподдержанный формат, запуск Podkop не ломается.

## Поддерживаемые подписки

Addon пробует несколько User-Agent для обычных client subscription endpoints: Happ, Hiddify Next, v2rayN, v2rayNG, NekoBox, Clash Meta for Android, sing-box, Shadowrocket и curl.

Поддерживаются plain/base64/base64url списки, а также JSON/YAML-обертки, если внутри есть proxy-ссылки. Сейчас импортируются ссылки:

- `vless://`
- `ss://`
- `trojan://`
- `socks4://`
- `socks4a://`
- `socks5://`
- `hysteria2://`
- `hy2://`

## Требования

- Установленный Podkop и luci-app-podkop.
- OpenWrt с `opkg` или `apk`.
- Доступ роутера к URL подписки.

## Установка

```sh
wget -O - https://raw.githubusercontent.com/asv-debug/Podkop_SUB/main/install.sh | sh
```

Если GitHub Raw недоступен с роутера:

```sh
wget -O - https://cdn.jsdelivr.net/gh/asv-debug/Podkop_SUB@main/install.sh | sh
```

После установки откройте LuCI: `Services -> Podkop -> Подписки`.

Установщик сначала пробует стабильный URL последнего релиза:

- `https://github.com/asv-debug/Podkop_SUB/releases/latest/download/podkop-subscriptions.ipk`
- `https://github.com/asv-debug/Podkop_SUB/releases/latest/download/podkop-subscriptions.apk`

## Как пользоваться

1. Выберите секцию Podkop, куда нужно сохранить сервер.
2. Вставьте URL подписки.
3. Оставьте `User-Agent` в режиме автоопределения или выберите нужный клиент вручную.
4. Нажмите `Загрузить серверы`.
5. При необходимости нажмите `Проверить` в колонке `Пинг`.
6. Нажмите `Выбрать` у нужного сервера.
7. Перезапустите Podkop:

```sh
/etc/init.d/podkop restart
```

## Что делает пакет

- Делает backup исходного `/www/luci-static/resources/view/podkop/podkop.js`.
- Восстанавливает `/usr/bin/podkop`, `/usr/lib/podkop/helpers.sh` и `section.js` из backup, если они были изменены старыми версиями addon.
- Добавляет `/www/luci-static/resources/view/podkop/subscriptions.js`.
- Устанавливает `/usr/bin/podkop-subscriptions`.
- Добавляет ACL для LuCI/rpcd.
- Удаляет старые cron-задания `podkop-subscription-update-*`, если они остались от версий 0.1.x.
- Не заменяет весь Podkop и не трогает текущий `/etc/config/podkop`, пока вы сами не выбрали сервер.

## Удаление

```sh
opkg remove podkop-subscriptions
```

или для APK-based OpenWrt:

```sh
apk del podkop-subscriptions
```

При удалении пакет пытается восстановить файлы из backup и очищает кэш LuCI.
