import { initiateFiatSweep } from './pdax';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
    try {
        const result = await initiateFiatSweep(100, {
            method: 'fiat',
            fiatProvider: 'GCash',
            fiatAccountName: 'Test Name',
            fiatAccountNumber: '09190690982'
        });
        console.log("Success:", result);
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
