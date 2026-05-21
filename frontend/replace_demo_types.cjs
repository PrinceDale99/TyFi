const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx') || file.endsWith('.ts')) results.push(file);
    }
  });
  return results;
}

const files = walk('./src');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  content = content.replace(/'demo' \| 'testnet' \| 'mainnet'/g, "'testnet' | 'mainnet'");
  content = content.replace(/network = 'demo'/g, "network = 'testnet'");
  content = content.replace(/network \?: 'demo' \| 'testnet' \| 'mainnet'/g, "network?: 'testnet' | 'mainnet'");
  content = content.replace(/network: 'demo' \| 'testnet' \| 'mainnet'/g, "network: 'testnet' | 'mainnet'");
  
  if (file.includes('FarmerVerification.tsx')) {
    content = content.replace(/demo-fcm/g, 'testnet-fcm');
    content = content.replace(/demo-rsbsa-form.pdf/g, 'testnet-rsbsa-form.pdf');
    content = content.replace(/demo-passport-id.png/g, 'testnet-passport-id.png');
  }
  
  if (file.includes('CertificateList.tsx')) {
    content = content.replace(/network === 'demo'/g, "network === 'testnet'");
  }

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  }
});
