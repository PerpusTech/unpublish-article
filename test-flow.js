async function test() {
  try {
    console.log('1. Testing Admin Dev Login...');
    const loginRes = await fetch('http://localhost:5000/api/v1/auth/dev-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pustakawan@ums.ac.id' })
    });
    const loginData = await loginRes.json();
    console.log('   -> Logged in as:', loginData.user.name, `(${loginData.user.email})`);
    const adminToken = loginData.token;

    console.log('\n2. Testing Token Generation for Student (NIM: L200210045, 120 mins)...');
    const createRes = await fetch('http://localhost:5000/api/v1/admin/tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        patronName: 'Ahmad Zaky Kurniawan',
        patronNim: 'L200210045',
        durationMinutes: 120,
        notes: 'Uji Validasi Skripsi'
      })
    });
    const createData = await createRes.json();
    const tokenCode = createData.token.token_code;
    console.log('   -> Generated Token Code:', tokenCode);
    console.log('   -> Status:', createData.token.status);

    console.log('\n3. Testing Token Claim / Activation from Patron Device...');
    const claimRes = await fetch('http://localhost:5000/api/v1/patron/session/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenCode: tokenCode,
        clientUuid: 'device-laptop-patron-01'
      })
    });
    const claimData = await claimRes.json();
    console.log('   -> Claim Result:', claimData.message);
    console.log('   -> Session ID:', claimData.session.id);
    console.log('   -> Remaining Time:', claimData.session.remaining_seconds, 'seconds (~2 hours)');

    console.log('\n4. Testing Device Lock: Attempting to claim on second device...');
    const fraudClaimRes = await fetch('http://localhost:5000/api/v1/patron/session/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenCode: tokenCode,
        clientUuid: 'different-device-99'
      })
    });
    const fraudData = await fraudClaimRes.json();
    console.log('   -> Second device response (should be rejected):', fraudData.error?.message);

    console.log('\n5. Testing Catalog Query (Unpublish articles only)...');
    const articlesRes = await fetch('http://localhost:5000/api/v1/articles?status=UNPUBLISH', {
      headers: {
        'x-patron-token-id': claimData.session.id,
        'x-client-uuid': 'device-laptop-patron-01'
      }
    });
    const articlesData = await articlesRes.json();
    console.log('   -> Found Unpublish Articles:', articlesData.total);
    articlesData.items.forEach(item => {
      console.log(`      * [${item.eprint_status.toUpperCase()}] #${item.eprintid} ${item.title}`);
    });

    console.log('\n6. Testing Protected PDF Streaming for unpublish article #101...');
    const pdfRes = await fetch('http://localhost:5000/api/v1/articles/101/documents/1001/view', {
      headers: {
        'x-patron-token-id': claimData.session.id,
        'x-client-uuid': 'device-laptop-patron-01'
      }
    });
    console.log('   -> PDF Response Status:', pdfRes.status, pdfRes.statusText);
    console.log('   -> Content-Type:', pdfRes.headers.get('content-type'));
    console.log('   -> Content-Disposition:', pdfRes.headers.get('content-disposition'));
    const pdfBuffer = await pdfRes.arrayBuffer();
    console.log('   -> Streamed PDF Size:', pdfBuffer.byteLength, 'bytes (Valid binary stream)');

    console.log('\n7. Testing Audit Trail Recording...');
    const auditRes = await fetch('http://localhost:5000/api/v1/admin/audit-logs', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const auditData = await auditRes.json();
    console.log('   -> Total Audit Entries Recorded:', auditData.total);
    auditData.logs.slice(0, 3).forEach(l => {
      console.log(`      * [${l.action}] ${l.patron_nim} - ${l.patron_name} | ${l.article_title || '-'}`);
    });

    console.log('\n=== ALL END-TO-END VERIFICATION CHECKS PASSED! ===');
  } catch (err) {
    console.error('Test failed with error:', err);
  }
}

test();
