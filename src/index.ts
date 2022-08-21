import { listenToNFT } from "./watcher";
import { Command } from 'commander';
const program = new Command();


program
  .description('This is a simple CLI tool to watch for NFTs and notify when they are bought.')
  .argument('<ntf_address>', 'The NFT Address to watch')
  .option('-p, --price <price>', 'The price to buy the NFT for')
  .action((nft_address, options) => {
    const price = Number(options.price || 0);
    listenToNFT(nft_address, price);
  });

program.parse();