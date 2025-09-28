'use client';

import {
    CHOCO_CHIP_TYPE,
    MELTYFI_PACKAGE_ID,
    PROTOCOL_OBJECT_ID,
    WONKA_BAR_TYPE
} from '@/constants/contracts';
import {
    useCurrentAccount,
    useSignAndExecuteTransaction,
    useSuiClient
} from '@mysten/dapp-kit';
import type { SuiObjectResponse } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { toast } from 'sonner';

export interface Lottery {
    id: string;
    lotteryId: string;
    owner: string;
    state: 'ACTIVE' | 'CANCELLED' | 'CONCLUDED';
    createdAt: number;
    expirationDate: number;
    wonkaBarPrice: string;
    maxSupply: string;
    soldCount: string;
    totalRaised: string;
    winner?: string;
    winningTicket?: string;
    // Updated NFT metadata
    nftName: string;
    nftDescription: string;
    nftImageUrl: string;
    nftType: string;
    collateralNft: {
        id: string;
        name: string;
        imageUrl: string;
        collection?: string;
        type?: string;
    };
    participants: number;
}

export interface WonkaBar {
    id: string;
    lotteryId: string;
    owner: string;
    ticketCount: string;
    purchasedAt: number;
}

export interface UserStats {
    activeLotteries: number;
    totalLotteries: number;
    totalWonkaBars: number;
    chocoChipBalance: string;
    suiBalance: string;
}

// Helper function to parse object content
function parseObjectContent(obj: SuiObjectResponse): any {
    if (obj.data?.content?.dataType === 'moveObject') {
        return (obj.data.content as any).fields;
    }
    return null;
}

// Parse WonkaBar object
function parseWonkaBar(obj: SuiObjectResponse): WonkaBar | null {
    const fields = parseObjectContent(obj);
    if (!fields || !obj.data?.objectId) return null;

    try {
        return {
            id: obj.data.objectId,
            lotteryId: fields.lottery_id?.toString() || '0',
            owner: fields.owner || '',
            ticketCount: fields.ticket_count?.toString() || '1',
            purchasedAt: parseInt(fields.purchased_at || '0')
        };
    } catch (error) {
        console.error('Error parsing WonkaBar:', error);
        return null;
    }
}

export function useMeltyFi() {
    const currentAccount = useCurrentAccount();
    const suiClient = useSuiClient();
    const queryClient = useQueryClient();
    const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

    // Fetch all lotteries
    const { data: lotteries = [], isLoading: isLoadingLotteries } = useQuery({
        queryKey: ['lotteries'],
        queryFn: async () => {
            try {
                // Fetch lottery creation events
                const objects = await suiClient.queryEvents({
                    query: {
                        MoveEventType: `${MELTYFI_PACKAGE_ID}::meltyfi_core::LotteryCreated`
                    },
                    limit: 100,
                    order: 'descending'
                });

                // Get lottery objects from events and fetch actual lottery objects
                const lotteryPromises = objects.data.map(async (event) => {
                    try {
                        const parsedJson = event.parsedJson as any;
                        if (parsedJson?.lottery_id) {
                            // Try to find the actual lottery object by querying all objects of Lottery type
                            let lotteryObjectId = null;
                            try {
                                const lotteryObjects = await suiClient.queryEvents({
                                    query: {
                                        MoveEventType: `${MELTYFI_PACKAGE_ID}::meltyfi_core::LotteryCreated`
                                    },
                                    limit: 1,
                                    order: 'descending'
                                });
                                
                                // Use the transaction digest to find created objects
                                if (event.id?.txDigest) {
                                    const txDetails = await suiClient.getTransactionBlock({
                                        digest: event.id.txDigest,
                                        options: { showObjectChanges: true }
                                    });
                                    
                                    // Find the created Lottery object
                                    const lotteryObject = txDetails.objectChanges?.find(change => 
                                        change.type === 'created' && 
                                        change.objectType?.includes('::meltyfi_core::Lottery')
                                    );
                                    
                                    if (lotteryObject && 'objectId' in lotteryObject) {
                                        lotteryObjectId = lotteryObject.objectId;
                                    }
                                }
                            } catch (err) {
                                console.warn('Could not fetch lottery object ID:', err);
                            }

                            return {
                                id: lotteryObjectId || `lottery_${parsedJson.lottery_id}`,
                                lotteryId: parsedJson.lottery_id?.toString() || '0',
                                owner: parsedJson.owner || '',
                                state: 'ACTIVE' as const,
                                createdAt: Date.now(),
                                expirationDate: parseInt(parsedJson.expiration_date || '0'),
                                wonkaBarPrice: parsedJson.wonka_price?.toString() || '0',
                                maxSupply: parsedJson.max_supply?.toString() || '0',
                                soldCount: '0',
                                totalRaised: '0',
                                // Read actual NFT metadata from event
                                nftName: parsedJson.nft_name || 'Collateral NFT',
                                nftDescription: parsedJson.nft_description || 'NFT used as collateral for this lottery',
                                nftImageUrl: parsedJson.nft_image_url || '/placeholder-nft.svg',
                                nftType: parsedJson.nft_type || 'Unknown',
                                collateralNft: {
                                    id: 'nft_placeholder',
                                    name: parsedJson.nft_name || 'Collateral NFT',
                                    imageUrl: parsedJson.nft_image_url || '/placeholder-nft.svg',
                                    collection: parsedJson.nft_type || 'Unknown Collection',
                                    type: parsedJson.nft_type || 'Unknown'
                                },
                                participants: 0
                            } as Lottery;
                        }
                        return null;
                    } catch (err) {
                        console.error('Error processing lottery event:', err);
                        return null;
                    }
                });

                const resolved = await Promise.all(lotteryPromises);
                return resolved.filter((lottery): lottery is Lottery => lottery !== null);
            } catch (error) {
                console.error('Error fetching lotteries:', error);
                return [];
            }
        },
        refetchInterval: 10000,
    });

    // Fetch user's WonkaBars
    const { data: userWonkaBars = [], isLoading: isLoadingWonkaBars } = useQuery({
        queryKey: ['wonkaBars', currentAccount?.address],
        queryFn: async () => {
            if (!currentAccount?.address) return [];

            try {
                const objects = await suiClient.getOwnedObjects({
                    owner: currentAccount.address,
                    filter: { StructType: WONKA_BAR_TYPE },
                    options: {
                        showContent: true,
                        showDisplay: true,
                        showType: true,
                    },
                });

                return objects.data
                    .map((obj: any) => parseWonkaBar(obj))
                    .filter((wonkaBar): wonkaBar is WonkaBar => wonkaBar !== null);
            } catch (error) {
                console.error('Error fetching WonkaBars:', error);
                return [];
            }
        },
        enabled: !!currentAccount?.address,
        refetchInterval: 15000,
    });

    // Fetch user's ChocoChip balance
    const { data: chocoChipBalance = '0' } = useQuery({
        queryKey: ['chocoChipBalance', currentAccount?.address],
        queryFn: async () => {
            if (!currentAccount?.address) return '0';

            try {
                const balance = await suiClient.getBalance({
                    owner: currentAccount.address,
                    coinType: CHOCO_CHIP_TYPE,
                });
                return balance.totalBalance;
            } catch (error) {
                console.error('Error fetching ChocoChip balance:', error);
                return '0';
            }
        },
        enabled: !!currentAccount?.address,
    });

    // Fetch user's SUI balance
    const { data: suiBalance = '0' } = useQuery({
        queryKey: ['suiBalance', currentAccount?.address],
        queryFn: async () => {
            if (!currentAccount?.address) return '0';

            try {
                const balance = await suiClient.getBalance({
                    owner: currentAccount.address,
                });
                return balance.totalBalance;
            } catch (error) {
                console.error('Error fetching SUI balance:', error);
                return '0';
            }
        },
        enabled: !!currentAccount?.address,
    });

    // Calculate user stats
    const userStats = useMemo((): UserStats | null => {
        if (!currentAccount?.address) return null;

        const userLotteries = lotteries.filter(lottery => lottery.owner === currentAccount.address);
        const activeLotteries = userLotteries.filter(lottery =>
            lottery.state === 'ACTIVE' && Date.now() < lottery.expirationDate
        );

        return {
            activeLotteries: activeLotteries.length,
            totalLotteries: userLotteries.length,
            totalWonkaBars: userWonkaBars.length,
            chocoChipBalance,
            suiBalance,
        };
    }, [lotteries, userWonkaBars, chocoChipBalance, suiBalance, currentAccount?.address]);

    // Create lottery mutation
    const { mutateAsync: createLottery, isPending: isCreatingLottery } = useMutation({
        mutationFn: async ({
            nftId,
            expirationDate,
            wonkaBarPrice,
            maxSupply,
        }: {
            nftId: string;
            expirationDate: number;
            wonkaBarPrice: string;
            maxSupply: string;
        }) => {
            console.log('🚀 Starting createLottery with params:', {
                nftId,
                expirationDate,
                wonkaBarPrice,
                maxSupply,
                currentAccount: currentAccount?.address
            });

            if (!currentAccount?.address) {
                console.error('❌ No wallet connected');
                throw new Error('Wallet not connected');
            }

            // Check if contracts are configured
            console.log('🔧 Contract configuration:', {
                MELTYFI_PACKAGE_ID,
                PROTOCOL_OBJECT_ID,
                configured: !!(MELTYFI_PACKAGE_ID && PROTOCOL_OBJECT_ID)
            });

            if (!MELTYFI_PACKAGE_ID || !PROTOCOL_OBJECT_ID) {
                console.error('❌ Contract addresses not configured');
                throw new Error('Contract addresses not configured. Please check your environment variables.');
            }

            try {
                // First, get the NFT object to determine its type
                console.log('🔍 Fetching NFT object...');
                const nftObject = await suiClient.getObject({
                    id: nftId,
                    options: { showContent: true, showType: true, showOwner: true }
                });

                console.log('📦 NFT Object:', nftObject);

                if (!nftObject.data?.type) {
                    console.error('❌ Could not determine NFT type');
                    throw new Error('Could not determine NFT type');
                }

                const nftType = nftObject.data.type;
                console.log('🎯 NFT Type:', nftType);

                // Check NFT ownership
                const owner = nftObject.data.owner;
                console.log('👤 NFT Owner:', owner);

                if (owner && typeof owner === 'object' && 'AddressOwner' in owner && owner.AddressOwner !== currentAccount.address) {
                    console.error('❌ NFT not owned by current account');
                    throw new Error('You do not own this NFT');
                }

                // Extract NFT metadata
                let nftName = "Lottery NFT";
                let nftDescription = "NFT used as collateral in MeltyFi lottery"; 
                let nftImageUrl = "/placeholder-nft.svg";

                try {
                    const nftContent = nftObject.data.content;
                    console.log('🔍 NFT Content:', JSON.stringify(nftContent, null, 2));
                    
                    if (nftContent && 'fields' in nftContent) {
                        const fields = nftContent.fields as any;
                        console.log('📋 NFT Fields:', JSON.stringify(fields, null, 2));
                        
                        // Try different field names for NFT metadata
                        if (fields.name) nftName = String(fields.name);
                        else if (fields.title) nftName = String(fields.title);
                        
                        if (fields.description) nftDescription = String(fields.description);
                        else if (fields.desc) nftDescription = String(fields.desc);
                        
                        if (fields.image_url) nftImageUrl = String(fields.image_url);
                        else if (fields.url) nftImageUrl = String(fields.url);
                        else if (fields.image) nftImageUrl = String(fields.image);
                        
                        console.log('✅ Extracted NFT metadata:', { nftName, nftDescription, nftImageUrl });
                    }
                    
                    // Also check if there's a display field (common in Sui NFTs)
                    if (nftObject.data.display) {
                        const display = nftObject.data.display as any;
                        console.log('🖼️ NFT Display:', JSON.stringify(display, null, 2));
                        
                        if (display.data) {
                            if (display.data.name) nftName = String(display.data.name);
                            if (display.data.description) nftDescription = String(display.data.description);
                            if (display.data.image_url) nftImageUrl = String(display.data.image_url);
                        }
                    }
                } catch (error) {
                    console.warn('⚠️ Could not extract NFT metadata, using defaults:', error);
                }

                console.log('🎨 Final NFT metadata:', { nftName, nftDescription, nftImageUrl });

                console.log('🔧 Creating transaction...');
                const tx = new Transaction();

                // Set gas budget explicitly
                tx.setGasBudget(100_000_000); // Increase to 0.1 SUI

                // Validate parameters
                const expirationDateNum = Number(expirationDate);
                const wonkaBarPriceNum = Number(wonkaBarPrice);
                const maxSupplyNum = Number(maxSupply);

                console.log('📊 Parsed parameters:', {
                    expirationDateNum,
                    wonkaBarPriceNum,
                    maxSupplyNum
                });

                if (expirationDateNum <= Date.now()) {
                    throw new Error('Expiration date must be in the future');
                }

                if (wonkaBarPriceNum <= 0) {
                    throw new Error('WonkaBar price must be greater than 0');
                }

                if (maxSupplyNum <= 0) {
                    throw new Error('Max supply must be greater than 0');
                }

                // Call create_lottery function with NFT metadata
                console.log('📝 Adding moveCall to transaction...');
                console.log('🎨 Using NFT metadata:', { nftName, nftDescription, nftImageUrl });
                
                tx.moveCall({
                    target: `${MELTYFI_PACKAGE_ID}::meltyfi::create_lottery`,
                    arguments: [
                        tx.object(PROTOCOL_OBJECT_ID),         // protocol: &mut Protocol
                        tx.object(nftId),                      // nft: T (transferred to contract)
                        tx.pure.u64(expirationDateNum),       // expiration_date: u64
                        tx.pure.u64(wonkaBarPriceNum),        // wonka_price: u64
                        tx.pure.u64(maxSupplyNum),            // max_supply: u64
                        tx.pure.vector('u8', Array.from(new TextEncoder().encode(nftName))),           // nft_name: vector<u8>
                        tx.pure.vector('u8', Array.from(new TextEncoder().encode(nftDescription))),    // nft_description: vector<u8>
                        tx.pure.vector('u8', Array.from(new TextEncoder().encode(nftImageUrl))),       // nft_image_url: vector<u8>
                        tx.object('0x6'),                     // clock: &Clock
                    ],
                    typeArguments: [nftType], // Specify the NFT type
                });

                console.log('✅ Transaction prepared successfully:', {
                    target: `${MELTYFI_PACKAGE_ID}::meltyfi::create_lottery`,
                    nftId,
                    nftType,
                    expirationDate: expirationDateNum,
                    wonkaBarPrice: wonkaBarPriceNum,
                    maxSupply: maxSupplyNum,
                    protocolId: PROTOCOL_OBJECT_ID,
                    gasBudget: 100_000_000
                });

                console.log('🔐 Requesting signature from wallet...');
                const result = await signAndExecuteTransaction({
                    transaction: tx
                });

                console.log('✅ Transaction completed:', result);
                return result;

            } catch (error) {
                console.error('💥 Transaction failed:', error);
                if (error instanceof Error) {
                    console.error('Error details:', {
                        message: error.message,
                        stack: error.stack,
                        name: error.name
                    });
                } else {
                    console.error('Error details:', error);
                }
                throw error;
            }
        },
        onSuccess: (result) => {
            console.log('🎉 Lottery created successfully:', result);
            queryClient.invalidateQueries({ queryKey: ['lotteries'] });
            queryClient.invalidateQueries({ queryKey: ['suiBalance'] });
            toast.success('Lottery created successfully!');
        },
        onError: (error) => {
            console.error('🚨 createLottery mutation failed:', error);

            // More specific error messages
            if (error.message.includes('not configured')) {
                toast.error('Contract not configured. Please check deployment.');
            } else if (error.message.includes('Wallet not connected')) {
                toast.error('Please connect your wallet first.');
            } else if (error.message.includes('Could not determine NFT type')) {
                toast.error('Invalid NFT selected. Please try a different NFT.');
            } else if (error.message.includes('do not own')) {
                toast.error('You do not own this NFT.');
            } else if (error.message.includes('Expiration date')) {
                toast.error('Please set a valid expiration date in the future.');
            } else if (error.message.includes('price must be greater')) {
                toast.error('Please set a valid WonkaBar price.');
            } else if (error.message.includes('supply must be greater')) {
                toast.error('Please set a valid max supply.');
            } else {
                toast.error(`Failed to create lottery: ${error.message}`);
            }
        },
    });
    // Buy WonkaBars mutation
    const { mutateAsync: buyWonkaBars, isPending: isBuyingWonkaBars } = useMutation({
        mutationFn: async ({
            lotteryId,
            quantity,
            paymentAmount,
        }: {
            lotteryId: string;
            quantity: number;
            paymentAmount: string;
        }) => {
            if (!currentAccount?.address) throw new Error('Wallet not connected');

            console.log('🎫 Buying WonkaBars:', { lotteryId, quantity, paymentAmount });

            const tx = new Transaction();

            // Convert SUI amount to MIST (multiply by 10^9)
            const paymentAmountMist = Math.floor(parseFloat(paymentAmount) * 1_000_000_000);
            console.log('💰 Payment amount in MIST:', paymentAmountMist);

            // Create a coin for the payment
            const [coin] = tx.splitCoins(tx.gas, [paymentAmountMist]);

            tx.moveCall({
                target: `${MELTYFI_PACKAGE_ID}::meltyfi::buy_wonka_bars`,
                arguments: [
                    tx.object(PROTOCOL_OBJECT_ID),    // protocol: &mut Protocol
                    tx.object(lotteryId),             // lottery: &mut Lottery (this should be the shared lottery object ID)
                    coin,                             // payment: Coin<SUI>
                    tx.pure.u64(quantity),           // quantity: u64
                    tx.object('0x6'),                // clock: &Clock
                ],
            });

            console.log('📝 Transaction prepared for WonkaBar purchase');

            const result = await signAndExecuteTransaction({
                transaction: tx
            });

            console.log('✅ WonkaBar purchase transaction executed:', result);
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lotteries'] });
            queryClient.invalidateQueries({ queryKey: ['wonkaBars'] });
            queryClient.invalidateQueries({ queryKey: ['suiBalance'] });
            toast.success('WonkaBars purchased successfully!');
        },
        onError: (error) => {
            console.error('Error buying WonkaBars:', error);
            toast.error('Failed to buy WonkaBars');
        },
    });

    // Resolve lottery mutation (for lottery owners or admin)
    const { mutateAsync: resolveLottery, isPending: isResolvingLottery } = useMutation({
        mutationFn: async ({ lotteryId }: { lotteryId: string }) => {
            if (!currentAccount?.address) throw new Error('Wallet not connected');

            const tx = new Transaction();

            tx.moveCall({
                target: `${MELTYFI_PACKAGE_ID}::meltyfi::resolve_lottery`,
                arguments: [
                    tx.object(PROTOCOL_OBJECT_ID),
                    tx.object(lotteryId),
                    tx.object('0x8'), // Random object
                    tx.object('0x6'), // Clock object
                ],
            });

            const result = await signAndExecuteTransaction({
                transaction: tx
            });

            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lotteries'] });
            queryClient.invalidateQueries({ queryKey: ['wonkaBars'] });
            toast.success('Lottery resolved successfully!');
        },
        onError: (error) => {
            console.error('Error resolving lottery:', error);
            toast.error('Failed to resolve lottery');
        },
    });

    // Redeem WonkaBar mutation (for winners)
    const { mutateAsync: redeemWonkaBars, isPending: isRedeemingWonkaBars } = useMutation({
        mutationFn: async ({
            lotteryId,
            wonkaBarId,
        }: {
            lotteryId: string;
            wonkaBarId: string;
        }) => {
            if (!currentAccount?.address) throw new Error('Wallet not connected');

            const tx = new Transaction();

            // This function would need to be implemented in your Move contract
            tx.moveCall({
                target: `${MELTYFI_PACKAGE_ID}::meltyfi::redeem_wonka_bar`,
                arguments: [
                    tx.object(PROTOCOL_OBJECT_ID),
                    tx.object(lotteryId),
                    tx.object(wonkaBarId),
                ],
            });

            const result = await signAndExecuteTransaction({
                transaction: tx
            });

            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lotteries'] });
            queryClient.invalidateQueries({ queryKey: ['wonkaBars'] });
            queryClient.invalidateQueries({ queryKey: ['suiBalance'] });
            queryClient.invalidateQueries({ queryKey: ['chocoChipBalance'] });
            toast.success('WonkaBar redeemed successfully!');
        },
        onError: (error) => {
            console.error('Error redeeming WonkaBar:', error);
            toast.error('Failed to redeem WonkaBar');
        },
    });

    return {
        // Data
        lotteries,
        userWonkaBars,
        userStats,

        // Loading states
        isLoadingLotteries,
        isLoadingWonkaBars,

        // Mutations
        createLottery,
        isCreatingLottery,
        buyWonkaBars,
        isBuyingWonkaBars,
        resolveLottery,
        isResolvingLottery,
        redeemWonkaBars,
        isRedeemingWonkaBars,
    };
}