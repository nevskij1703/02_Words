// КОПИЯ ИЗ admin/client/testBridgeKey.js — НЕ ПРАВИТЬ ЗДЕСЬ.
// Обновляется: node tools/sync-client.mjs --write  (из папки admin)
// Правки вносить в admin/client/testBridgeKey.js, иначе они потеряются при следующей
// синхронизации, а две копии разойдутся молча.

// СГЕНЕРИРОВАНО tools/testbridge-keys.mjs — НЕ ПРАВИТЬ РУКАМИ. created: 2026-09-10
//
// ПУБЛИЧНЫЙ ключ тестового моста. Им игра проверяет, что команда подписана нами.
// Подписать им нельзя — для этого нужен приватный, и он лежит только в
// admin/secrets. Значит, этот файл не секрет: его копия внутри APK не даёт
// никаких прав, и лежать в открытом репозитории игры он может спокойно.

export const TEST_BRIDGE_PUBLIC_KEY = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEKydEDx9oQ5rFY0crBsNJFUlEwFaMSPHj6FLTDgrHwFfoQImf7B7D+nJ0SkK76aruPDXFftQqWyAv4iM3eYIXQg==";
