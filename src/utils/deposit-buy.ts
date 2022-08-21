import * as anchor from '@project-serum/anchor';
import * as borsh from '@project-serum/borsh';
import * as solanaWeb3 from '@solana/web3.js';
import { serialize } from 'borsh';
import axios from 'axios';
import { EOperations } from './enums';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { config } from '../config';
import { Attribute, IMetadataExtension } from './metadata';

interface IEdenInfo extends IMetadataExtension {
  attributes: Attribute[];
  collection: string;
  externalUrl: string;
  image: string;
  mintAddress: string;
  name: string;
  owner: string;
  primarySaleHappened: boolean;
  sellerFeeBasisPoints: number;
  supply: number;
  updateAuthority: string;
}

export function decodeEscrowAccountData(data: string) {
  const dataLayout = borsh.struct([
    borsh.publicKey('initializerKey'),
    borsh.publicKey('initializerDepositTokenAccount'),
    borsh.publicKey('account1'),
    borsh.publicKey('account2'),
    borsh.publicKey('account3'),
    borsh.u64('takerAmount')
  ]);
  const t = dataLayout.decode(Buffer.from(data));
  for (let i = 0; i < Object.keys(t).length; i++) {
    t[Object.keys(t)[i]] = Object.values<any>(t)[i].toString();
  }
  const nftAddress = t.initializerKey as string;
  return nftAddress;
}

export function getPriceFromBase64DataV1(base64Data: Buffer) {
  const data_layout = borsh.struct([
    borsh.u64('nonSoCheE'),
    borsh.publicKey('owner'),
    borsh.publicKey('escrowID'),
    borsh.u64('price'),
  ]);
  const t = data_layout.decode(base64Data);
  for (let i = 0; i < Object.keys(t).length; i++) {
    t[Object.keys(t)[i]] = Object.values<any>(t)[i].toString();
  }
  const escrowPubkey = t.escrowID as string;
  const walletVenditore = t.owner as string;
  const encodedPrice = Number(t.price);
  return { walletVenditore, escrowPubkey, encodedPrice };
}

export interface IParsedPriceData {
  escrowPubkey: string;
  walletVenditore: string;
  price: number;
  itemAddress: string;
  operation: string;
  encodedPrice: string;
}

export function getPriceFromBase64DataV2(base64Data: Buffer): IParsedPriceData {
  const data_layout = borsh.struct([
    // Reversed
    borsh.u64('operation'),
    borsh.publicKey('owner'),
    borsh.publicKey('escrowID'),
    borsh.publicKey('authAccount'),
    borsh.u64('price'),
    borsh.publicKey('itemAddress'),

    // Not reversed
    borsh.u64('tag1'),
    borsh.u64('tag2'),
    borsh.publicKey('account3'),
    borsh.u64('tag3'),
    borsh.publicKey('account4'),
    borsh.publicKey('account5'),
  ]);
  const t = data_layout.decode(base64Data);
  for (let i = 0; i < Object.keys(t).length; i++) {
    t[Object.keys(t)[i]] = Object.values<any>(t)[i].toString();
  }
  const escrowPubkey = t.escrowID as string;
  const walletVenditore = t.owner as string;
  const price = Number(t.price) * 0.000000001;
  const itemAddress = t.itemAddress as string;
  const operation = EOperations[t.operation] as string;
  const encodedPrice = encodePrice(t.price);
  return { walletVenditore, escrowPubkey, price, itemAddress, operation, encodedPrice };
}

class Assignable {
  constructor(properties: any) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const instance: any = this;
    Object.keys(properties).map((key) => {
      instance[key] = properties[key];
    });
  }
}

function secret2array(str: string) {
  return new Uint8Array(JSON.parse(str as string));
}

export function encodePrice(cifraIntera: number) {
  const g = { x: '8179382949091792022', y: String(cifraIntera) };
  const value = new Assignable(g);
  const schema = new Map([[Assignable, { kind: 'struct', fields: [['x', 'u64'], ['y', 'u64'],] }]]);
  const encodedPrice = Buffer.from(serialize(schema, value)).toString('hex');
  return encodedPrice;
}

async function getEdenInfo(mint: string): Promise<IEdenInfo | null> {
  try {
    const rawData = await axios.get<IEdenInfo>(
      `${config.magiceden.apiEndpoint}/tokens/${mint}`,
    );
    return rawData.data;
  } catch (e) {
    console.log(e);
  }
  return null;
}

export async function buyItem(mint: string, privateKey: string, price: number): Promise<IEdenInfo | undefined> {

  const apiEndpoint = config.magiceden.apiEndpoint;
  const authToken = config.magiceden.authToken;
  const auctionHouseAddress = config.magiceden.auctionHouse;

  const conn = new anchor.web3.Connection(anchor.web3.clusterApiUrl('mainnet-beta'));
  const buyer = solanaWeb3.Keypair.fromSecretKey(secret2array(privateKey));
  const wallet = new anchor.Wallet(buyer);
  const provider = new anchor.AnchorProvider(conn, wallet, anchor.AnchorProvider.defaultOptions());
  const tokenKey = new solanaWeb3.PublicKey(mint);
  const edenInfo = await getEdenInfo(mint);

  if (!edenInfo) {
    return undefined;
  }

  const seller = new solanaWeb3.PublicKey(edenInfo.owner);
  const tokenATA = await findAssociatedTokenAddress(seller, tokenKey);

  // Get buy instruction from API
  let response: any = {};
  try {
    response = await axios.get(
      `${apiEndpoint}/instructions/buy_now`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      params: {
        buyer: buyer.publicKey.toBase58(),
        seller: seller.toBase58(),
        auctionHouseAddress,
        tokenMint: tokenKey.toBase58(),
        tokenATA: tokenATA.toBase58(),
        price,
        sellerExpiry: 0,
        expiry: 10,
      }
    });
  } catch (error) {
    console.log(error);
    return undefined;
  }
  // Use the txSigned field (the old `tx` field is deprecated)
  // Under the hood, txSigned is a direct serialization of the "Transaction",
  // not just the "Message" object.
  // Note, if you saw serialization error message, please make sure your anchor version is at least 0.24.2
  const txSigned = response.data.txSigned;
  const txn = anchor.web3.Transaction.from(Buffer.from(txSigned.data));
  await provider.wallet.signTransaction(txn);
  try {
    const result = await anchor.web3.sendAndConfirmRawTransaction(conn, txn.serialize());
    console.log(result);
    return edenInfo;
  } catch (error) {
    console.log(error);
  }
  return undefined;
}

const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID: solanaWeb3.PublicKey = new solanaWeb3.PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);

export async function findAssociatedTokenAddress(
  walletAddress: solanaWeb3.PublicKey,
  tokenMintAddress: solanaWeb3.PublicKey
): Promise<solanaWeb3.PublicKey> {
  return (await solanaWeb3.PublicKey.findProgramAddress(
    [
      walletAddress.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      tokenMintAddress.toBuffer(),
    ],
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
  ))[0];
}
