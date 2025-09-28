'use client';

import { getExplorerUrl } from '@/constants/contracts';
import { useMeltyFi } from '@/hooks/useMeltyFi';
import { useCurrentAccount } from '@mysten/dapp-kit';
import {
    AlertCircle,
    ExternalLink,
    Search,
    Ticket,
    TrendingUp,
    Trophy
} from 'lucide-react';
import { useState } from 'react';
import SafeImage from '@/components/SafeImage';

interface LotteryCardProps {
    lottery: any;
    onBuyWonkaBars: (lotteryId: string, quantity: number, totalCost: string) => void;
    onCancelLottery: (lotteryId: string) => void;
    isBuying: boolean;
    isCancelling: boolean;
    isConnected: boolean;
    currentUserAddress?: string;
    userLotteryReceipts?: Array<{ id: string; lotteryId: string; owner: string }>;
}

function LotteryCard({ lottery, onBuyWonkaBars, onCancelLottery, isBuying, isCancelling, isConnected, currentUserAddress, userLotteryReceipts }: LotteryCardProps) {
    const [quantity, setQuantity] = useState(1);

    const wonkaBarPrice = parseInt(lottery.wonkaBarPrice);
    const totalCost = (wonkaBarPrice * quantity).toString();
    const formatSuiAmount = (amount: string | number) => (Number(amount) / 1_000_000_000).toFixed(4);

    const isExpired = Date.now() > lottery.expirationDate;
    const isSoldOut = parseInt(lottery.soldCount) >= parseInt(lottery.maxSupply);
    const canPurchase = isConnected && !isExpired && !isSoldOut && lottery.state === 'ACTIVE';
    const isOwner = currentUserAddress && lottery.owner === currentUserAddress;
    const hasReceipt = userLotteryReceipts?.some(r => r.lotteryId === lottery.lotteryId);
    const canCancel = isOwner && hasReceipt && lottery.state === 'ACTIVE' && !isExpired;

    const timeLeft = lottery.expirationDate - Date.now();
    const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    return (
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden hover:bg-white/10 transition-all duration-300">
                    {/* NFT Image */}
        <div className="relative h-48 bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <SafeImage
                src={lottery.collateralNft.imageUrl}
                alt={lottery.collateralNft.name}
                fill
                className="object-cover"
                fallbackIcon={<Ticket className="w-8 h-8 text-white" />}
            />

                {/* Status Badge */}
                <div className="absolute top-4 left-4">
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${lottery.state === 'ACTIVE' && !isExpired && !isSoldOut
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : isExpired
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : isSoldOut
                                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                        }`}>
                        {isExpired ? 'EXPIRED' : isSoldOut ? 'SOLD OUT' : lottery.state}
                    </div>
                </div>

                {/* Lottery ID */}
                <div className="absolute top-4 right-4">
                    <div className="px-2 py-1 bg-black/50 rounded text-xs text-white/80">
                        #{lottery.lotteryId}
                    </div>
                </div>
            </div>

            <div className="p-6">
                {/* Header */}
                <div className="mb-4">
                    <h3 className="text-lg font-semibold text-white mb-1">{lottery.collateralNft.name}</h3>
                    {lottery.collateralNft.collection && (
                        <p className="text-sm text-white/60">{lottery.collateralNft.collection}</p>
                    )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <span className="text-xs text-white/60">Price per WonkaBar</span>
                        <p className="text-sm font-medium text-white">{formatSuiAmount(wonkaBarPrice)} SUI</p>
                    </div>
                    <div>
                        <span className="text-xs text-white/60">Sold</span>
                        <p className="text-sm font-medium text-white">{lottery.soldCount}/{lottery.maxSupply}</p>
                    </div>
                    <div>
                        <span className="text-xs text-white/60">Participants</span>
                        <p className="text-sm font-medium text-white">{lottery.participants}</p>
                    </div>
                    <div>
                        <span className="text-xs text-white/60">Time Left</span>
                        <p className="text-sm font-medium text-white">
                            {isExpired ? 'Expired' : `${daysLeft}d ${hoursLeft}h`}
                        </p>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                    <div className="flex justify-between text-xs text-white/60 mb-2">
                        <span>Progress</span>
                        <span>{Math.round((parseInt(lottery.soldCount) / parseInt(lottery.maxSupply)) * 100)}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                        <div
                            className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(parseInt(lottery.soldCount) / parseInt(lottery.maxSupply)) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Purchase/Action Section */}
                {isOwner ? (
                    <div className="space-y-3">
                        <div className="text-center py-2">
                            <div className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-sm mb-3 inline-block">
                                🎨 This is your NFT
                            </div>
                            {canCancel ? (
                                <>
                                    <div className="text-sm text-white/60 mb-3">
                                        {parseInt(lottery.soldCount) === 0 ? (
                                            <p>No participants yet - cancel and get your NFT back</p>
                                        ) : (
                                            <div>
                                                <p className="mb-2">💰 Repay loan to cancel and get your NFT back</p>
                                                <p className="text-xs text-yellow-300">
                                                    Cost: {formatSuiAmount(lottery.totalRaised)} SUI 
                                                    ({parseInt(lottery.soldCount)} tickets sold)
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => onCancelLottery(lottery.id)}
                                        disabled={isCancelling}
                                        className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
                                    >
                                        {isCancelling ? 'Cancelling...' : 
                                         parseInt(lottery.soldCount) === 0 ? 'Cancel & Get NFT Back' : 
                                         'Repay Loan & Get NFT Back'}
                                    </button>
                                </>
                            ) : (
                                <p className="text-sm text-yellow-400">
                                    {lottery.state !== 'ACTIVE' 
                                        ? 'Lottery not active' 
                                        : isExpired
                                            ? 'Lottery has expired'
                                            : 'Cannot cancel at this time'
                                    }
                                </p>
                            )}
                        </div>
                    </div>
                ) : canPurchase ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <label htmlFor={`quantity-${lottery.id}`} className="text-sm text-white/80">
                                Quantity:
                            </label>
                            <input
                                id={`quantity-${lottery.id}`}
                                type="number"
                                min="1"
                                max={parseInt(lottery.maxSupply) - parseInt(lottery.soldCount)}
                                value={quantity}
                                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-20 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                            />
                        </div>

                        <div className="text-sm text-white/60">
                            Total: {formatSuiAmount(totalCost)} SUI
                        </div>

                        <button
                            onClick={() => onBuyWonkaBars(lottery.id, quantity, totalCost)}
                            disabled={isBuying}
                            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
                        >
                            {isBuying ? 'Purchasing...' : `Buy ${quantity} WonkaBar${quantity > 1 ? 's' : ''}`}
                        </button>
                    </div>
                ) : (
                    <div className="text-center py-3">
                        {!isConnected ? (
                            <p className="text-sm text-white/60">Connect wallet to participate</p>
                        ) : isExpired ? (
                            <p className="text-sm text-red-400">Lottery has expired</p>
                        ) : isSoldOut ? (
                            <p className="text-sm text-yellow-400">All WonkaBars sold</p>
                        ) : (
                            <p className="text-sm text-white/60">Lottery not active</p>
                        )}
                    </div>
                )}

                {/* Concluded Lottery - Melt Information */}
                {(lottery.state === 'CONCLUDED' || lottery.state === 'CANCELLED') && (
                    <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                        <div className="flex items-center space-x-2 mb-2">
                            <span className="text-lg">🍫</span>
                            <h4 className="text-sm font-semibold text-white">
                                {lottery.state === 'CONCLUDED' ? 'Lottery Concluded!' : 'Lottery Cancelled'}
                            </h4>
                        </div>
                        <p className="text-xs text-gray-300 mb-3">
                            {lottery.state === 'CONCLUDED' 
                                ? 'Participants can now melt their WonkaBars to claim rewards!' 
                                : 'Participants can melt WonkaBars for full refunds + ChocoChips!'
                            }
                        </p>
                        {lottery.winner && (
                            <div className="flex items-center space-x-2 mb-2">
                                <Trophy className="w-4 h-4 text-yellow-400" />
                                <span className="text-xs text-yellow-400 font-medium">
                                    Winner: {lottery.winner.slice(0, 6)}...{lottery.winner.slice(-4)}
                                </span>
                            </div>
                        )}
                        <div className="text-xs text-purple-300">
                            💰 Winners get NFT + ChocoChips • 🎁 All participants get ChocoChips
                        </div>
                    </div>
                )}

                {/* Explorer Link */}
                <div className="mt-3 pt-3 border-t border-white/10">
                    <a
                        href={getExplorerUrl('object', lottery.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
                    >
                        View on Explorer <ExternalLink className="w-3 h-3" />
                    </a>
                </div>
            </div>
        </div>
    );
}

export default function LotteriesPage() {
    const currentAccount = useCurrentAccount();
    const {
        lotteries,
        buyWonkaBars,
        isBuyingWonkaBars,
        cancelLottery,
        isCancellingLottery,
        userLotteryReceipts,
        isLoadingLotteries
    } = useMeltyFi();

    const [searchQuery, setSearchQuery] = useState('');
    const [filterState, setFilterState] = useState<'all' | 'active' | 'ending-soon'>('all');
    const [sortBy, setSortBy] = useState<'newest' | 'ending-soon' | 'price-low' | 'price-high'>('newest');

    const handleBuyWonkaBars = async (lotteryId: string, quantity: number, totalCost: string) => {
        try {
            // Convert from MIST to SUI for display
            const paymentAmountSui = (parseInt(totalCost) / 1_000_000_000).toString();
            console.log('🎫 Purchasing WonkaBars:', { lotteryId, quantity, totalCost, paymentAmountSui });
            
            await buyWonkaBars({ 
                lotteryId, 
                quantity, 
                paymentAmount: paymentAmountSui 
            });
        } catch (error) {
            console.error('Failed to buy WonkaBars:', error);
        }
    };

    const handleCancelLottery = async (lotteryId: string) => {
        try {
            console.log('🚫 Cancelling lottery:', { lotteryId });
            await cancelLottery({ lotteryId });
        } catch (error) {
            console.error('Failed to cancel lottery:', error);
        }
    };

    // Filter and sort lotteries
    const filteredLotteries = lotteries
        .filter(lottery => {
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return (
                    lottery.collateralNft.name.toLowerCase().includes(query) ||
                    lottery.collateralNft.collection?.toLowerCase().includes(query) ||
                    lottery.lotteryId.includes(query)
                );
            }
            return true;
        })
        .filter(lottery => {
            // State filter
            if (filterState === 'active') {
                return lottery.state === 'ACTIVE' && Date.now() < lottery.expirationDate;
            }
            if (filterState === 'ending-soon') {
                const timeLeft = lottery.expirationDate - Date.now();
                return lottery.state === 'ACTIVE' && timeLeft < 24 * 60 * 60 * 1000; // Less than 24 hours
            }
            return true;
        })
        .sort((a, b) => {
            // Sort logic
            switch (sortBy) {
                case 'newest':
                    return parseInt(b.lotteryId) - parseInt(a.lotteryId);
                case 'ending-soon':
                    return a.expirationDate - b.expirationDate;
                case 'price-low':
                    return parseInt(a.wonkaBarPrice) - parseInt(b.wonkaBarPrice);
                case 'price-high':
                    return parseInt(b.wonkaBarPrice) - parseInt(a.wonkaBarPrice);
                default:
                    return 0;
            }
        });

    const activeLotteriesCount = lotteries.filter(l => l.state === 'ACTIVE' && Date.now() < l.expirationDate).length;
    const endingSoonCount = lotteries.filter(l => {
        const timeLeft = l.expirationDate - Date.now();
        return l.state === 'ACTIVE' && timeLeft < 24 * 60 * 60 * 1000;
    }).length;

    return (
        <div className="min-h-screen py-12">
            <div className="max-w-7xl mx-auto px-6">
                {/* Header */}
                <div className="text-center mb-16 animate-slide-up">
                    <div className="inline-flex items-center space-x-3 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center animate-float">
                            <Ticket className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black">
                            <span className="gradient-text">Active</span> Lotteries
                        </h1>
                    </div>
                    <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
                        Discover premium NFTs and join lotteries for a chance to win incredible digital assets at fraction of their value
                    </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                    <div className="card text-center group">
                        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Ticket className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-3xl font-bold gradient-text mb-2">{lotteries.length}</div>
                        <div className="text-gray-400">Total Lotteries</div>
                    </div>
                    <div className="card text-center group">
                        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <TrendingUp className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-3xl font-bold text-green-400 mb-2">{activeLotteriesCount}</div>
                        <div className="text-gray-400">Active Now</div>
                    </div>
                    <div className="card text-center group">
                        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <AlertCircle className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-3xl font-bold text-yellow-400 mb-2">{endingSoonCount}</div>
                        <div className="text-gray-400">Ending Soon</div>
                    </div>
                </div>

                {/* Filters and Search */}
                <div className="mb-12 space-y-6 md:space-y-0 md:flex md:items-center md:justify-between animate-slide-up" style={{ animationDelay: '0.4s' }}>
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search lotteries by name or type..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input pl-12 pr-4 py-3"
                        />
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-4">
                        <select
                            value={filterState}
                            onChange={(e) => setFilterState(e.target.value as any)}
                            className="px-4 py-3 rounded-xl glass border border-white/20 text-white focus:outline-none focus:border-blue-400 transition-all duration-300"
                        >
                            <option value="all" className="bg-gray-800">All Lotteries</option>
                            <option value="active" className="bg-gray-800">Active Only</option>
                            <option value="ending-soon" className="bg-gray-800">Ending Soon</option>
                        </select>

                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="px-4 py-3 rounded-xl glass border border-white/20 text-white focus:outline-none focus:border-blue-400 transition-all duration-300"
                        >
                            <option value="newest" className="bg-gray-800">Newest First</option>
                            <option value="ending-soon" className="bg-gray-800">Ending Soon</option>
                            <option value="price-low" className="bg-gray-800">Price: Low to High</option>
                            <option value="price-high" className="bg-gray-800">Price: High to Low</option>
                        </select>
                    </div>
                </div>

                {/* Loading State */}
                {isLoadingLotteries && (
                    <div className="text-center py-24 animate-fade-in">
                        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center animate-pulse-glow">
                            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">Loading Lotteries</h3>
                        <p className="text-gray-400">Fetching the latest NFT opportunities...</p>
                    </div>
                )}

                {/* No Results */}
                {!isLoadingLotteries && filteredLotteries.length === 0 && (
                    <div className="text-center py-24 animate-fade-in">
                        <div className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                            <Ticket className="w-12 h-12 text-gray-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">
                            {searchQuery || filterState !== 'all' ? 'No lotteries match your criteria' : 'No lotteries available'}
                        </h3>
                        <p className="text-xl text-gray-400 mb-8 max-w-md mx-auto">
                            {searchQuery || filterState !== 'all'
                                ? 'Try adjusting your search or filters to discover more opportunities'
                                : 'Be the first to create a lottery and unlock liquidity from your NFTs!'
                            }
                        </p>
                        {!searchQuery && filterState === 'all' && (
                            <a href="/create" className="btn-primary">
                                Create First Lottery
                            </a>
                        )}
                    </div>
                )}

                {/* Lotteries Grid */}
                {!isLoadingLotteries && filteredLotteries.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-slide-up" style={{ animationDelay: '0.6s' }}>
                        {filteredLotteries.map((lottery) => (
                            <LotteryCard
                                key={lottery.id}
                                lottery={lottery}
                                onBuyWonkaBars={handleBuyWonkaBars}
                                onCancelLottery={handleCancelLottery}
                                isBuying={isBuyingWonkaBars}
                                isCancelling={isCancellingLottery}
                                isConnected={!!currentAccount}
                                currentUserAddress={currentAccount?.address}
                                userLotteryReceipts={userLotteryReceipts}
                            />
                        ))}
                    </div>
                )}

                {/* Connection Warning */}
                {!currentAccount && !isLoadingLotteries && (
                    <div className="mt-12 card-premium border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 animate-slide-up" style={{ animationDelay: '0.8s' }}>
                        <div className="flex items-start space-x-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                                <AlertCircle className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-white mb-2">Connect Your Wallet</h3>
                                <p className="text-gray-300 mb-4">
                                    Connect your Sui wallet to participate in lotteries, purchase WonkaBars, and start winning amazing NFTs!
                                </p>
                                <div className="flex items-center space-x-3">
                                    <span className="text-sm text-gray-400">Supported wallets:</span>
                                    <div className="flex items-center space-x-2">
                                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-md border border-blue-500/30">Sui Wallet</span>
                                        <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-md border border-purple-500/30">Suiet</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
