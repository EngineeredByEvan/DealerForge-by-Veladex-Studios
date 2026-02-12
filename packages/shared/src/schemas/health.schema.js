"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthResponseSchema = void 0;
const zod_1 = require("zod");
exports.healthResponseSchema = zod_1.z.object({
    status: zod_1.z.literal('ok'),
    service: zod_1.z.literal('api'),
    timestamp: zod_1.z.string().datetime()
});
//# sourceMappingURL=health.schema.js.map