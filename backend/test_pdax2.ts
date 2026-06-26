import axios from 'axios';

async function test() {
    try {
        const res = await axios.post('https://uat.services.sandbox.pdax.ph/api/pdax-api/pdax-institution/v1/login', {
            username: "princedalelimosnero@gmail.com",
            password: "REDACTED_PDAX_PASSWORD"
        });
        console.log("Success:", res.data);
    } catch (e: any) {
        console.error("Error:", e.response?.data || e.message);
    }
}
test();
