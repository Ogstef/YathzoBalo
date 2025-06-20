// hooks/useGame.ts
import { useEffect, useState } from 'react';
import { GameState, ScoreCategory } from '../game/gameTypes';
import { BackendGameState, gameApi, PossibleScores } from '../services/gameApi';

// Convert backend format to frontend format (now they match!)
const mapBackendToFrontend = (backendState: BackendGameState): GameState => ({
  dice: backendState.dice,
  selectedDice: [], // Frontend manages selected dice
  rollsLeft: backendState.rollsLeft,
  currentRound: backendState.currentRound,
  scoreSheet: backendState.scoreSheet, // Direct assignment now works
  gameComplete: backendState.gameComplete,
  totalScore: backendState.totalScore,
});

export const useGame = () => {
  const [gameState, setGameState] = useState<GameState>({
    dice: [1, 1, 1, 1, 1],
    selectedDice: [],
    rollsLeft: 3,
    currentRound: 1,
    scoreSheet: {
      ones: null, twos: null, threes: null, fours: null, fives: null, sixes: null,
      upperBonus: 0, upperTotal: 0,
      threeOfkind: null, fourOfkind: null, fullHouse: null,
      smallStraight: null, largeStraight: null, yahtzee: null, chance: null,
      lowerTotal: 0
    },
    gameComplete: false,
    totalScore: 0
  });

  const [currentGameId, setCurrentGameId] = useState<number | null>(null);
  const [possibleScores, setPossibleScores] = useState<PossibleScores | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fetch possible scores when dice change
  useEffect(() => {
    if (currentGameId && gameState.rollsLeft < 3) {
      fetchPossibleScores();
    }
  }, [currentGameId, gameState.dice, gameState.rollsLeft]);

  const handleApiCall = async <T>(apiCall: () => Promise<T>): Promise<T | null> => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCall();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('API call failed:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const newGame = async (playerName: string = 'Player') => {
    const result = await handleApiCall(() => gameApi.createNewGame(playerName));
    if (result) {
      setCurrentGameId(result.gameId);
      setGameState(mapBackendToFrontend(result));
      setPossibleScores(null);
    }
  };

  const rollDice = async () => {
    if (!currentGameId || gameState.rollsLeft <= 0) return;

    const result = await handleApiCall(() => 
      gameApi.rollDice(currentGameId, gameState.selectedDice)
    );
    
    if (result) {
      setGameState(prev => ({
        ...mapBackendToFrontend(result),
        selectedDice: [] // Clear selected dice after roll
      }));
    }
  };

  const toggleDie = (index: number) => {
    if (gameState.rollsLeft === 3) return; // Can't select before first roll

    setGameState(prev => ({
      ...prev,
      selectedDice: prev.selectedDice.includes(index)
        ? prev.selectedDice.filter(i => i !== index)
        : [...prev.selectedDice, index]
    }));
  };

  const scoreCategory = async (category: ScoreCategory) => {
    if (!currentGameId || gameState.scoreSheet[category] !== null) return;

    // Convert frontend category names to backend format (now they match!)
    const categoryMap: { [key in ScoreCategory]: string } = {
      ones: 'ones',
      twos: 'twos', 
      threes: 'threes',
      fours: 'fours',
      fives: 'fives',
      sixes: 'sixes',
      threeOfkind: 'threeofkind',
      fourOfkind: 'fourofkind',
      fullHouse: 'fullhouse',
      smallStraight: 'smallStraight',
      largeStraight: 'largeStraight',
      yahtzee: 'yahtzee',
      chance: 'chance'
    };

    const backendCategory = categoryMap[category];
    const result = await handleApiCall(() => 
      gameApi.selectScore(currentGameId, backendCategory)
    );

    if (result) {
      setGameState(prev => ({
        ...mapBackendToFrontend(result),
        selectedDice: [] // Clear selected dice after scoring
      }));
      setPossibleScores(null); // Will be refetched automatically
    }
  };

  const fetchPossibleScores = async () => {
    if (!currentGameId) return;

    console.log('🎯 Fetching possible scores for game:', currentGameId);
    const result = await handleApiCall(() => gameApi.getPossibleScores(currentGameId));
    if (result) {
      console.log('📊 Received possible scores:', result);
      setPossibleScores(result);
    } else {
      console.log('❌ Failed to fetch possible scores');
    }
  };

  const getPossibleScores = () => {
    const categories: Array<{ category: ScoreCategory; name: string }> = [
      { category: 'ones', name: 'Ones' },
      { category: 'twos', name: 'Twos' },
      { category: 'threes', name: 'Threes' },
      { category: 'fours', name: 'Fours' },
      { category: 'fives', name: 'Fives' },
      { category: 'sixes', name: 'Sixes' },
      { category: 'threeOfkind', name: 'Three of a Kind' },
      { category: 'fouroOkind', name: 'Four of a Kind' },
      { category: 'fullHouse', name: 'Full House' },
      { category: 'smallStraight', name: 'Small Straight' },
      { category: 'largeStraight', name: 'Large Straight' },
      { category: 'yahtzee', name: 'YAHTZEE!' },
      { category: 'chance', name: 'Chance' }
    ];

    // Map backend possible scores to frontend format (now they match!)
    const scoreMap: { [key in ScoreCategory]: keyof PossibleScores } = {
      ones: 'ones',
      twos: 'twos',
      threes: 'threes', 
      fours: 'fours',
      fives: 'fives',
      sixes: 'sixes',
      threeOfkind: 'threeOfkind',       // Now matches exactly
      fourOfkind: 'fourOfkind',         // Now matches exactly
      fullHouse: 'fullHouse',           // Now matches exactly
      smallStraight: 'smallStraight',   // Now matches exactly
      largeStraight: 'largeStraight',   // Now matches exactly
      yahtzee: 'yahtzee',
      chance: 'chance'
    };

    // Fallback score calculation if API doesn't provide scores
    const calculateLocalScore = (dice: number[], category: ScoreCategory): number => {
      const counts = dice.reduce((acc, die) => {
        acc[die] = (acc[die] || 0) + 1;
        return acc;
      }, {} as { [key: number]: number });
      
      const sorted = [...dice].sort((a, b) => a - b);
      const sum = dice.reduce((a, b) => a + b, 0);

      switch (category) {
        case 'ones': return dice.filter(d => d === 1).length * 1;
        case 'twos': return dice.filter(d => d === 2).length * 2;
        case 'threes': return dice.filter(d => d === 3).length * 3;
        case 'fours': return dice.filter(d => d === 4).length * 4;
        case 'fives': return dice.filter(d => d === 5).length * 5;
        case 'sixes': return dice.filter(d => d === 6).length * 6;
        case 'threeofkind': return Object.values(counts).some(c => c >= 3) ? sum : 0;
        case 'fourofkind': return Object.values(counts).some(c => c >= 4) ? sum : 0;
        case 'fullhouse': {
          const values = Object.values(counts).sort();
          return (values.length === 2 && values[0] === 2 && values[1] === 3) ? 25 : 0;
        }
        case 'smallstraight': {
          const unique = [...new Set(sorted)];
          const straights = ['1234', '2345', '3456'];
          const diceString = unique.join('');
          return straights.some(straight => diceString.includes(straight)) ? 30 : 0;
        }
        case 'largestraight': {
          const unique = [...new Set(sorted)];
          return (unique.length === 5 && (unique.join('') === '12345' || unique.join('') === '23456')) ? 40 : 0;
        }
        case 'yahtzee': return Object.values(counts).some(c => c === 5) ? 50 : 0;
        case 'chance': return sum;
        default: return 0;
      }
    };

    return categories.map(({ category, name }) => {
      let score = 0;
      
      if (possibleScores && possibleScores[scoreMap[category]] !== undefined) {
        score = possibleScores[scoreMap[category]];
        console.log(`🌐 Using API score for ${name}:`, score);
      } else {
        // Fallback to local calculation
        score = calculateLocalScore(gameState.dice, category);
        console.log(`🔄 Using local calculation for ${name}:`, score);
      }
      
      const isAvailable = gameState.scoreSheet[category] === null;
      console.log(`Final score for ${name} (${category}):`, score, 'Available:', isAvailable);
      
      return {
        category,
        name,
        score,
        isAvailable
      };
    });
  };

  // Auto-start game on hook initialization
  useEffect(() => {
    newGame('Player');
  }, []);

  return {
    gameState,
    currentGameId,
    loading,
    error,
    possibleScores, // Add this line - export the possibleScores state
    rollDice,
    toggleDie,
    scoreCategory,
    getPossibleScores,
    newGame,
    fetchPossibleScores
  };
};