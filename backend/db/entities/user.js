const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "User",
    tableName: "users",
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: true,
        },
        tenant_id: {
            type: "varchar",
            length: 255,
            nullable: false,
        },
        email: {
            type: "varchar",
            length: 255,
            unique: true,
            nullable: false,
        },
        provider: {
            type: "varchar",
            length: 50,
            nullable: false,
        },
        password: {
            type: "varchar",
            length: 255,
            nullable: true,
        },
        access_token: {
            type: "text",
            nullable: true,
        },
        refresh_token: {
            type: "text",
            nullable: true,
        },
        created_at: {
            type: "timestamp",
            default: () => "CURRENT_TIMESTAMP",
        },
        updated_at: {
            type: "timestamp",
            default: () => "CURRENT_TIMESTAMP",
            onUpdate: "CURRENT_TIMESTAMP",
        },
    },
});
