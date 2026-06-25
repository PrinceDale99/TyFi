// Webhook for SMS claim filing fallback
exports.handleSms = (req, res) => {
  // Process SMS message to trigger claim
  res.status(200).send('SMS claim received');
};
