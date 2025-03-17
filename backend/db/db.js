const { DataSource } = require("typeorm");
const User = require("./entities/user");

const { DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME } = process.env;

const AppDataSource = new DataSource({
    type: "mysql",
    host: DB_HOST,
    port: DB_PORT,
    username: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    entities: [User],
    logging: true,
});

const initializeDatabase = async () => {
    try {
        await AppDataSource.initialize();
    } catch (error) {
        console.error("db error", error);
        // kills process on DB error
        process.exit(1);
    }
};

module.exports = { AppDataSource, initializeDatabase, User };
