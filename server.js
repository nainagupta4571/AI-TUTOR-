const appModule = require("./app");
const app = typeof appModule === "function" ? appModule : appModule.app || appModule;

const PORT = process.env.PORT || 5000;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
