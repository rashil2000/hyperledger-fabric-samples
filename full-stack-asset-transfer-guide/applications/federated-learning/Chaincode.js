const { Client, credentials } = require('@grpc/grpc-js');
const { connect, signers } = require('@hyperledger/fabric-gateway');
const createPrivateKey = require('crypto').createPrivateKey;
const readFileSync = require('fs').readFileSync;

const credentialPem = readFileSync('../../_cfg/uf/_msp/org1/org1admin/msp/signcerts/cert.pem');
const privateKeyPem = readFileSync('../../_cfg/uf/_msp/org1/org1admin/msp/keystore/cert_sk');
const mspId = 'org1MSP';
const endpoint = 'org1peer-api.127-0-0-1.nip.io:8080';
const channel = 'mychannel';
const contract = 'asset-transfer';

const client = new Client(endpoint, credentials.createInsecure());
const gateway = connect({
    identity: { mspId, credentials: credentialPem },
    signer: signers.newPrivateKeySigner(createPrivateKey(privateKeyPem)),
    client
});

async function Contribute(id, data) {
    try {
        await gateway
            .getNetwork(channel)
            .getContract(contract)
            .submitTransaction('ContributeResource', id, data);
    } catch(err) {
        console.error(err);
    }
}

async function Consume(id, requiredLength) {
    try {
        await gateway
            .getNetwork(channel)
            .getContract(contract)
            .submitTransaction('ConsumeResource', id, requiredLength.toString());
    } catch(err) {
        console.error(err);
    }
}

module.exports = { client, gateway, Contribute, Consume };
