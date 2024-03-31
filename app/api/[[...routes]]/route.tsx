/** @jsxImportSource frog/jsx */

import { Button, Frog, TextInput, parseEther } from 'frog';
import { handle } from "frog/next";
import {createWalletClient, http, createPublicClient} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { PinataFDK } from "pinata-fdk";
import abi from "./abi.json";

const fdk = new PinataFDK({
  pinata_jwt: process.env.PINATA_JWT || "",
  pinata_gateway:"",
});

const CONTRACT = process.env.CONTRACT_ADDRESS as `0x` || ""

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x` || "")

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.ALCHEMY_URL),
})

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(process.env.ALCHEMY_URL),
})

async function checkBalance(address: any) {
  try {
    const balance = await publicClient.readContract({
      address: CONTRACT,
      abi: abi.abi,
      functionName: "balanceOf",
      args: [address, 0],
    })
    const readableBalance = Number(balance);
    // return Number(balance);
    return readableBalance;
  } catch (error) {
    console.log(error)
    return error;
  }
}

async function remainingSupply() {
  try {
    const balance = await publicClient.readContract({
      address:CONTRACT,
      abi:abi.abi,
      functionName: "totalSupply",
    });

    const readableBalance = Number(balance);
    return readableBalance;
  } catch(error){
    console.log(error)
    return error;
  }
}

const app = new Frog({
  assetsPath: "/",
  basePath: "/api",
});

app.use("/ad", fdk.analyticsMiddleware({
  frameId: "hats-store"
}));
app.use(
  "/finish",
  fdk.analyticsMiddleware({
    frameId:"hats-store",
  })
);

// app.use(
//   "/ad",
//   fdk.analyticsMiddleware({ frameId: "hats-store", customId: "ad" }),
// );
// app.use(
//   "/finish",
//   fdk.analyticsMiddleware({ frameId: "hats-store", customId: "purchased" }),
// );

app.frame("/", async (c) => {
  const balance = await remainingSupply();
  if (typeof balance == "number" && balance === 0) {
    return c.res({
      image:"",
      imageAspectRatio: "1:1",
      intents: [
        <Button.Link href="https://kakarot.org">
          Join Kakarot Discord Channel
        </Button.Link>
      ],
      title: "Pinata Hat Store - SOLD OUT",
    });
  } else {
    return c.res({
      action: "/finish",
      image:"",
      imageAspectRatio: "1:1",
      intents: [
        <Button.Transaction target="/buy/0.0005">
          Buyt for 0.0005 ETH
        </Button.Transaction>,
        <Button action="/ad">
          Watch ad for 1/2 off
        </Button>,
      ],
      title: "Pinata Hat Store",
    })
  }
});

app.frame("/finish", (c) => {
  return c.res({
    image:
      "",
      imageAspectRatio: "1:1",
      intents: [
        <Button.Link href="https://kakarot.org">
          Join the Kakarot Channel
        </Button.Link>
      ],
      title: "Pinata Hat Store",
  })
})

app.frame("/ad", async (c) => {
  return c.res({
    action: "/coupon",
    image:
    "",
    imageAspectRatio: "1:1",
    intents: [
      <TextInput placeholder="Wallet Address (not ENS)" />,
      <Button>Receive Coupon</Button>,
    ],
    title: "Pinata Hat Store",
  })
})

app.frame("/coupon", async (c) => {
  const supply = await remainingSupply();
  const address = c.inputText;
  const balance = await checkBalance(address);

  if (
    typeof balance == "number" && balance < 1 && typeof supply == "number" && supply > 0
  ) {
    const { request: mint } = await publicClient.simulateContract({
      account,
      address: CONTRACT,
      abi: abi.abi,
      functionName: "mint",
      args: [address],
    });

    const mintTransaction = await walletClient.writeContract(mint);
    console.log(mintTransaction);

    const mintReceipt = await publicClient.waitForTransactionReceipt({
      hash: mintTransaction,
    });
    console.log("Mint Status:", mintReceipt.status);
  }

  return c.res({
    action: "/finish",
    image:
    "",
    imageAspectRatio: "1:1",
    intents: [
      <Button.Transaction target="/buy/0.00025">
        Buy for 0.00025ETH
      </Button.Transaction>
    ],
    title: "Pinata Hat Store",
  })
})

app.transaction("/buy/:price", async (c) => {
  const price = c.req.param('price')

  return c.contract({
    abi: abi.abi,
    // @ts-ignore
    chainId: "eip155:85432",
    funcitonNAme: "buytHat",
    args: [c.frameData?.fid],
    to: CONTRACT,
    // @ts-ignore
    value: parseEther(`${price}`),
  });
});

app.frame('/test', (c) => {
  return c.res({
    action: '/test-finish',
    image: (
      <div style={{ color: 'white', display: 'flex', fontSize: 60 }}>
        Perform a transaction
      </div>
    ),
    intents: [
      <TextInput placeholder="Value (ETH)" />,
      <Button.Transaction target="/send-ether">Send Ether</Button.Transaction>,
    ]
  })
})

app.frame('/test-finish', (c) => {
  const { transactionId } = c
  return c.res({
    image: (
      <div style={{ color: 'white', display: 'flex', fontSize: 60 }}>
        Transaction ID: {transactionId}
      </div>
    )
  })
})
app.transaction('/send-ether', (c) => {
  const { inputText } = c
  // Send transaction response.
  return c.send({
    chainId: 'eip155:10',
    to: '0xd2135CfB216b74109775236E36d4b433F1DF507B',
    value: parseEther(inputText as string),
  })
})
 

export const GET = handle(app);
export const POST = handle(app);