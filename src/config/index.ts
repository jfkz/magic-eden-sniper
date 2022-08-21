import * as dotenv from 'dotenv';
dotenv.config();

interface IConfig {
  quicknode: {
    http: string;
    ws: string;
  };
  magiceden: {
    contract: string;
    apiEndpoint: string;
    authToken: string;
    auctionHouse: string;
  };
  buyer: {
    privateKey: string;
  }
}

export const config: IConfig = {
  quicknode: {
    http: `https://${process.env.QUICKNODE_URL}`,
    ws: `wss://${process.env.QUICKNODE_URL}`,
  },
  magiceden: {
    contract: `${process.env.MAGICEDEN_CONTRACT}`,
    apiEndpoint: `${process.env.MAGICEDEN_API_ENDPOINT}`,
    authToken: `${process.env.MAGICEDEN_AUTH_TOKEN}`,
    auctionHouse: `${process.env.MAGICEDEN_AUCTION_HOUSE}`,
  },
  buyer: {
    privateKey: `${process.env.BUYER_PRIVATE_KEY}`,
  }
};

