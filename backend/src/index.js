"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const stellar_1 = require("./services/stellar");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 8080;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'tyfi-backend-layer2' });
});
// Start the Express server
app.listen(port, () => {
    console.log(`[TyFi Backend] Layer 2 services listening on port ${port}`);
    // Initialize the Stellar listener for Vault payouts
    (0, stellar_1.setupStellarListener)().catch(err => {
        console.error('Failed to setup Stellar listener:', err);
    });
});
//# sourceMappingURL=index.js.map