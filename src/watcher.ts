import * as solana from '@solana/web3.js';
import { config } from './config';
import { buyItem, getPriceFromBase64DataV2, IParsedPriceData } from './utils';
import _ from 'lodash';

const getWsClient = (): solana.Connection => new solana.Connection(
  config.quicknode.http,
  {
    wsEndpoint: config.quicknode.ws,
  },
);

export const listenToNFT = async (nftAddress: string, price: number): Promise<void> => {
  const webSocketClient = getWsClient();

  const magicEdenAddress = new solana.PublicKey(config.magiceden.contract);

  // Register a callback to listen to the wallet (ws subscription)
  webSocketClient.onProgramAccountChange(
    magicEdenAddress,
    async (action) => {
      const data = action.accountInfo.data;

      if (data) {
        const priceData = getPriceFromBase64DataV2(data);
        
        // If the price is higher as the one we are looking for, ignore it
        if (nftAddress === priceData.itemAddress
          && (price === 0 || price >= priceData.price)) {
          const address = priceData.itemAddress;

          const itemInfo = await buyItem(address, config.buyer.privateKey, price);

          if (itemInfo) {
            const message = `Price: ${price}, Address: ${itemInfo.mintAddress}`;
            console.log(`Item ${itemInfo.name} was bought!`);
          } else {
            console.log(`Item ${address} was not bought for price ${price}.`);
          }
        }
      }
    },
    'processed',
  );
};
