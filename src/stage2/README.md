# 阶段 2 数据底座

本目录提供正式领域模型、Repository 命令边界和可替换的 Native Storage 契约。`MemoryNativeStorage` 仅用于 Node 自动测试；Android 实现必须以同样的单次 `transaction` 契约映射到 SQLite 事务，UI 不可执行 SQL。

数据库 schema 为版本 2：以 UUID 为内部 ID、金额为整数分。未来 schema 拒绝写入；旧 schema 在事务开头升级。迁移只处理备份副本的输入包，使用 `sourceId + 输入 SHA-256 + migrationVersion` 记录幂等性，验证失败时事务不提交。
