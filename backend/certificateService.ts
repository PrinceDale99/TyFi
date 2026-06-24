import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import admin from 'firebase-admin';
import { logEvent } from './logger';

export async function generateCertificate(data: {
  address: string;
  farmId: string;
  region: string;
  season: string;
  premium: number;
  txHash: string;
  network?: string;
}) {
  const { address, farmId, region, season, premium, txHash, network = 'testnet' } = data;
  const payoutAmount = premium * 10;
  
  return new Promise<string>(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
      });

      const chunks: any[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          
          // Upload to Firebase Storage
          const bucket = admin.storage().bucket();
          const filename = `certificates/${address}/${txHash}.pdf`;
          const file = bucket.file(filename);
          
          await file.save(buffer, {
            metadata: { 
              contentType: 'application/pdf',
              cacheControl: 'public, max-age=31536000'
            }
          });
          
          // Get a signed URL that lasts for a very long time
          const [url] = await file.getSignedUrl({
            action: 'read',
            expires: '03-01-2500', // Far future
          });
          
          // Save metadata to Firestore
          const db = admin.firestore();
          await db.collection('farmers').doc(address).collection('certificates').doc(txHash).set({
            farmId,
            region,
            season,
            premium,
            payoutAmount,
            txHash,
            downloadUrl: url,
            network,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });
          
          await logEvent('INFO', 'Certificate generated and stored successfully', { address, txHash, network });
          resolve(url);
        } catch (uploadErr: any) {
          await logEvent('ERROR', 'Failed to save certificate to Storage/Firestore', { errorMessage: uploadErr.message });
          reject(uploadErr);
        }
      });

      // --- PDF Design: Official & Beautiful ---
      
      // Header Background
      doc.rect(0, 0, 595.28, 140).fill('#020617');
      
      // Logo/Title
      doc.fillColor('#38bdf8').fontSize(34).font('Helvetica-Bold').text('TyFi', 50, 45);
      doc.fillColor('#ffffff').fontSize(10).font('Helvetica').text('DECENTRALIZED PARAMETRIC INSURANCE', 50, 85);
      
      // Right side header info
      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text('PROTOCOL VERSION', 450, 50, { align: 'right' });
      doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold').text('v2.4-STABLE', 450, 62, { align: 'right' });
      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text('NETWORK', 450, 85, { align: 'right' });
      doc.fillColor('#38bdf8').fontSize(10).font('Helvetica-Bold').text(network.toUpperCase(), 450, 97, { align: 'right' });

      // Main Title
      doc.fillColor('#020617').fontSize(26).font('Helvetica-Bold').text('CERTIFICATE OF INSURANCE', 50, 180, { align: 'center' });
      doc.moveTo(150, 215).lineTo(445, 215).lineWidth(2).stroke('#38bdf8');
      
      // Insured Details Section
      doc.fillColor('#64748b').fontSize(9).font('Helvetica-Bold').text('INSURED PARTICIPANT (STELLAR ADDRESS)', 50, 250);
      doc.fillColor('#1e293b').fontSize(11).font('Courier-Bold').text(address, 50, 265);
      
      // Farm & Region Grid
      doc.fillColor('#64748b').fontSize(9).font('Helvetica-Bold').text('FARM IDENTIFIER', 50, 310);
      doc.fillColor('#1e293b').fontSize(12).font('Helvetica-Bold').text(farmId, 50, 325);
      
      doc.fillColor('#64748b').fontSize(9).font('Helvetica-Bold').text('REGION & COVERAGE SEASON', 300, 310);
      doc.fillColor('#1e293b').fontSize(12).font('Helvetica-Bold').text(`${region} | ${season}`, 300, 325);
      
      // Financial Details Box
      doc.rect(50, 370, 495, 90).fill('#f8fafc');
      doc.rect(50, 370, 495, 90).lineWidth(1).stroke('#e2e8f0');
      
      doc.fillColor('#64748b').fontSize(9).font('Helvetica-Bold').text('TOTAL PREMIUM DEPOSITED', 75, 390);
      doc.fillColor('#0f172a').fontSize(22).font('Helvetica-Bold').text(`${premium.toLocaleString()} XLM`, 75, 405);
      
      doc.fillColor('#64748b').fontSize(9).font('Helvetica-Bold').text('MAXIMUM PARAMETRIC DISBURSAL', 310, 390);
      doc.fillColor('#0284c7').fontSize(22).font('Helvetica-Bold').text(`${payoutAmount.toLocaleString()} XLM`, 310, 405);
      
      // Validation Section
      doc.fillColor('#64748b').fontSize(10).font('Helvetica-Bold').text('LEDGER VERIFICATION', 50, 490);
      
      // QR Code for blockchain verification
      const qrData = `https://stellar.expert/explorer/${network}/tx/${txHash}`;
      const qrImage = await QRCode.toDataURL(qrData);
      doc.image(qrImage, 50, 510, { width: 90 });
      
      doc.fillColor('#1e293b').fontSize(8).font('Helvetica-Bold').text('BLOCKCHAIN PROOF OF COVERAGE', 160, 520);
      doc.fillColor('#64748b').fontSize(8).font('Helvetica').text('This insurance policy is recorded as an immutable entry on the Stellar Public Ledger. The transaction hash to the left uniquely identifies your premium deposit and the activation of the parametric smart contract logic.', 160, 535, { width: 350, align: 'justify' });
      doc.fillColor('#0284c7').fontSize(8).font('Courier').text(`TX: ${txHash}`, 160, 575);

      // Stamps / Signatures
      doc.rect(380, 620, 160, 80).dash(5, { space: 5 }).stroke('#cbd5e1');
      doc.fillColor('#cbd5e1').fontSize(8).font('Helvetica-Bold').text('PROTOCOL STAMP', 380, 655, { width: 160, align: 'center' });
      doc.fillColor('#94a3b8').fontSize(7).font('Helvetica').text('AUTOMATED SOROBAN EXECUTION', 380, 668, { width: 160, align: 'center' });
      
      // Important Notice
      doc.rect(50, 720, 495, 45).fill('#fff7ed');
      doc.fillColor('#9a3412').fontSize(8).font('Helvetica-Bold').text('NOTICE:', 65, 730);
      doc.fillColor('#c2410c').fontSize(8).font('Helvetica').text('Payouts are automated based on consensus-verified weather data. No manual claim submission is required. If a typhoon trigger is met, funds will be disbursed directly to the insured wallet address.', 105, 730, { width: 430 });

      // Footer
      doc.fillColor('#94a3b8').fontSize(7).font('Helvetica').text('TyFi Protocol is a decentralized autonomous insurance system. Terms and conditions are governed by the smart contract code at the specified address.', 50, 785, { align: 'center' });

      doc.end();

    } catch (error) {
      await logEvent('ERROR', 'Internal error during PDF generation', { errorMessage: (error as Error).message });
      reject(error);
    }
  });
}
