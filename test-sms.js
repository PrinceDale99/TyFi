const axios = require('axios');
const key = 'sk-2b10gae3brwm1sfusc6kjalevokaileq';
const url = 'https://smsapiph.onrender.com/api/v1/send/sms';

async function test(number) {
  try {
    const res = await axios.post(url, { recipient: number, message: 'Hello! This is a test message from the TyFi system verifying the new SMS API PH integration.' }, { headers: { 'x-api-key': key, 'Content-Type': 'application/json' } });
    console.log('Success for ' + number + ':', res.data);
  } catch (e) {
    console.error('Error for ' + number + ':', e.response ? e.response.data : e.message);
  }
}

test('+639939702450').then(() => test('+639456211175'));
