ALTER TABLE "identity"."permissions"
    ADD COLUMN "resource" VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN "action" VARCHAR(50) NOT NULL DEFAULT 'manage',
    ADD COLUMN "system_permission" BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE "identity"."permissions"
SET "resource" = CASE
        WHEN array_length(string_to_array("code", '.'), 1) > 2 THEN
            array_to_string(
                (string_to_array("code", '.'))[2:array_length(string_to_array("code", '.'), 1) - 1],
                '.'
            )
        ELSE split_part("code", '.', 1)
    END,
    "action" = substring("code" from '[^.]+$');
