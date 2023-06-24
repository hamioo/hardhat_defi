const { getNamedAccounts, ethers, network } = require("hardhat")
const { getWeth, AMOUNT } = require("../scripts/getWeth")
const { networkConfig } = require("../helper-hardhat-config")

async function main() {
  await getWeth()
  const { deployer } = await getNamedAccounts()
  const lendingPool = await getLendingPool(deployer)
  console.log(`LendingPool address ${lendingPool.address}`)
  const wethTokenAddress = networkConfig[network.config.chainId].wethToken
  await approveErc20(wethTokenAddress, lendingPool.address, AMOUNT, deployer)
  console.log("Depositing....")
  await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0)
  console.log("Deposited")

  // Getting your borrowing stats
  let { availableBorrowsETH, totalDebtETH } = await getBarrowUserData(
    lendingPool,
    deployer
  )
  const daiPrice = await getDaiPrice()
  const amountDaiToBorrow =
    availableBorrowsETH.toString() * 0.95 * (1 / daiPrice.toNumer())
  console.log(`you can borrow ${amountDaiToBorrow}`)
  const amountDaiToBorrowWai = ethers.utils.parseEther(
    amountDaiToBorrow.toString()
  )
  // 200810
  const daiTokenAddress = networkConfig[network.config.chainId].daiToken
  await borrowDai(daiTokenAddress, lendingPool, amountDaiToBorrowWai, deployer)
  await getBarrowUserData(lendingPool, deployer)

  await repay(amountDaiToBorrowWai, daiTokenAddress, lendingPool, deployer)
  await getBarrowUserData(lendingPool, deployer)
}

async function repay(amount, daiAddress, lendingPool, account) {
  await approveErc20(daiAddress, lendingPool.address, amount, account)
  const repayTx = await lendingPool.repay(daiAddress, amount, 1, account)
  console.log("Repaied")
}
async function borrowDai(
  daiAddress,
  lendingPool,
  amountDaiToBorrowWai,
  account
) {
  const borrowTx = await lendingPool.borrow(
    daiAddress,
    amountDaiToBorrowWai,
    1,
    0,
    account
  )
  await borrowTx.wait(1)
  console.log("you've borrowed!")
}

async function getDaiPrice() {
  const daiEthPriceFeed = await ethers.getContractAt(
    "AggregatorV3Interface",
    networkConfig[network.config.chainId].daiEthPriceFeed
  )
  const price = (await daiEthPriceFeed.latestRoundData())[1]
  console.log(`theDAI/ETH price is ${price.toString()}`)
  return price
}

async function getBarrowUserData(lendingPool, account) {
  const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
    await lendingPool.getUserAccountData(account)

  console.log(`You have ${totalCollateralETH} worth of ETH deposited.`)
  console.log(`You have ${totalDebtETH} worth of ETH borrowed.`)
  console.log(`You can borrow ${availableBorrowsETH} worth of ETH.`)

  return { availableBorrowsETH, totalDebtETH }
}

async function getLendingPool(account) {
  const lendingPoolAddressesProvider = await ethers.getContractAt(
    "ILendingPoolAddressesProvider",
    networkConfig[network.config.chainId].lendingPoolAddressesProvider,
    account
  )
  const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool()

  const lendingPool = await ethers.getContractAt(
    "ILendingPool",
    lendingPoolAddress,
    account
  )
  return lendingPool
}

async function approveErc20(
  erc20Address,
  spenderAddress,
  amountToSpend,
  accounts
) {
  const erc20Token = await ethers.getContractAt(
    "IERC20",
    erc20Address,
    accounts
  )
  const tx = await erc20Token.approve(spenderAddress, amountToSpend)
  await tx.wait(1)
  console.log("Approved!!")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
