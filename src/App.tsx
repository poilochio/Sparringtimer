import { useState, useEffect, useMemo, useCallback } from 'react';
import { Play, Pause, RotateCcw, Users } from 'lucide-react';

interface Matchup {
  size: 3 | 4;
  matchup: string;
}

function App() {
  // Setup state
  const [totalWrestlers, setTotalWrestlers] = useState<number | ''>(28);
  const [groupsOf3, setGroupsOf3] = useState<number>(0);
  const [groupsOf4, setGroupsOf4] = useState<number>(0);
  const [roundDuration, setRoundDuration] = useState<number>(60); // Duration in seconds: 60, 120, or 180
  const [showCustomConfig, setShowCustomConfig] = useState<boolean>(false);
  const [sessionStarted, setSessionStarted] = useState<boolean>(false);

  // Timer state
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [sessionDuration, setSessionDuration] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isPristine, setIsPristine] = useState<boolean>(true);
  const [completedMatchups, setCompletedMatchups] = useState<Matchup[]>([]);

  // Audio context
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  // Initialize audio context
  useEffect(() => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    setAudioContext(ctx);
    return () => ctx.close();
  }, []);

  // Play beep sound
  const playBeep = useCallback(() => {
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  }, [audioContext]);

  // Play loud countdown buzzer (continuous beeping)
  const playCountdownBuzzer = useCallback(() => {
    if (!audioContext) return;

    const beepCount = 10;
    const beepInterval = 0.2;

    for (let i = 0; i < beepCount; i++) {
      const startTime = audioContext.currentTime + (i * beepInterval);
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(1200, startTime);
      gainNode.gain.setValueAtTime(0.6, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.15);

      oscillator.start(startTime);
      oscillator.stop(startTime + 0.15);
    }
  }, [audioContext]);

  // Calculate recommended configuration
  const recommendation = useMemo(() => {
    const numWrestlers = typeof totalWrestlers === 'number' ? totalWrestlers : 0;
    const remainder = numWrestlers % 3;
    let groups3 = 0;
    let groups4 = 0;
    let explanation = '';

    if (remainder === 0) {
      groups3 = numWrestlers / 3;
      explanation = `All wrestlers can be evenly divided into groups of 3.`;
    } else if (remainder === 1) {
      groups3 = Math.floor(numWrestlers / 3) - 1;
      groups4 = 1;
      explanation = `One group of 4 and the rest in groups of 3 for optimal distribution.`;
    } else {
      groups3 = Math.floor(numWrestlers / 3) - 2;
      groups4 = 2;
      explanation = `Two groups of 4 and the rest in groups of 3 for optimal distribution.`;
    }

    return { groups3, groups4, explanation };
  }, [totalWrestlers]);

  // Validate custom configuration
  const isValidConfig = useMemo(() => {
    if (totalWrestlers === '') return false;
    return (groupsOf3 * 3) + (groupsOf4 * 4) === totalWrestlers;
  }, [groupsOf3, groupsOf4, totalWrestlers]);

  // Get current round for 3-person groups
  const getCurrentRound3 = useCallback((secondsElapsed: number): { wrestlers: string; resting: string } => {
    const round = Math.floor(secondsElapsed / roundDuration);
    switch (round % 3) {
      case 0: return { wrestlers: '1 vs 2', resting: '3' };
      case 1: return { wrestlers: '1 vs 3', resting: '2' };
      case 2: return { wrestlers: '2 vs 3', resting: '1' };
      default: return { wrestlers: '1 vs 2', resting: '3' };
    }
  }, [roundDuration]);

  // Get current round for 4-person groups
  const getCurrentRound4 = useCallback((secondsElapsed: number): { wrestlers: string; resting: string } => {
    const round = Math.floor(secondsElapsed / roundDuration);
    switch (round % 6) {
      case 0: return { wrestlers: '1 vs 2', resting: '3, 4' };
      case 1: return { wrestlers: '1 vs 3', resting: '2, 4' };
      case 2: return { wrestlers: '1 vs 4', resting: '2, 3' };
      case 3: return { wrestlers: '2 vs 3', resting: '1, 4' };
      case 4: return { wrestlers: '2 vs 4', resting: '1, 3' };
      case 5: return { wrestlers: '3 vs 4', resting: '1, 2' };
      default: return { wrestlers: '1 vs 2', resting: '3, 4' };
    }
  }, [roundDuration]);

  // Current matchups
  const currentMatchups = useMemo(() => {
    const secondsElapsed = sessionDuration - timeRemaining;
    const matchups = [];

    if (groupsOf3 > 0) {
      const round = getCurrentRound3(secondsElapsed);
      matchups.push({
        groupType: 3,
        count: groupsOf3,
        ...round
      });
    }

    if (groupsOf4 > 0) {
      const round = getCurrentRound4(secondsElapsed);
      matchups.push({
        groupType: 4,
        count: groupsOf4,
        ...round
      });
    }

    return matchups;
  }, [timeRemaining, sessionDuration, groupsOf3, groupsOf4, getCurrentRound3, getCurrentRound4]);

  // Timer countdown effect
  useEffect(() => {
    let interval: number | undefined;

    if (isActive && timeRemaining > 0) {
      interval = window.setInterval(() => {
        setTimeRemaining(prev => {
          const newTime = prev - 1;
          const secondsElapsed = sessionDuration - newTime;

          // Loud countdown buzzer at 10 seconds before end of round
          const secondsIntoCurrentRound = secondsElapsed % roundDuration;
          if (secondsIntoCurrentRound === roundDuration - 10) {
            playCountdownBuzzer();
          }

          // Beep and record matchup at end of each round
          if (secondsElapsed > 0 && secondsElapsed % roundDuration === 0) {
            playBeep();

            // Add completed matchups
            const newMatchups: Matchup[] = [];
            const roundJustCompleted = Math.floor(secondsElapsed / roundDuration) - 1;

            if (groupsOf3 > 0) {
              const round3 = getCurrentRound3((roundJustCompleted) * roundDuration);
              newMatchups.push({ size: 3, matchup: round3.wrestlers });
            }

            if (groupsOf4 > 0) {
              const round4 = getCurrentRound4((roundJustCompleted) * roundDuration);
              newMatchups.push({ size: 4, matchup: round4.wrestlers });
            }

            setCompletedMatchups(prev => [...prev, ...newMatchups]);
          }

          // Session complete
          if (newTime === 0) {
            playBeep();
            setIsActive(false);
          }

          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeRemaining, sessionDuration, groupsOf3, groupsOf4, roundDuration, playBeep, playCountdownBuzzer, getCurrentRound3, getCurrentRound4]);

  // Start session with recommended config
  const startWithRecommendation = () => {
    setGroupsOf3(recommendation.groups3);
    setGroupsOf4(recommendation.groups4);
    const totalRounds = recommendation.groups4 > 0 ? 6 : 3;
    const duration = totalRounds * roundDuration;
    setSessionDuration(duration);
    setTimeRemaining(duration);
    setSessionStarted(true);
    setCompletedMatchups([]);
  };

  // Start session with custom config
  const startWithCustom = () => {
    const totalRounds = groupsOf4 > 0 ? 6 : 3;
    const duration = totalRounds * roundDuration;
    setSessionDuration(duration);
    setTimeRemaining(duration);
    setSessionStarted(true);
    setCompletedMatchups([]);
  };

  // Start/Resume timer
  const handleStart = () => {
    if (isPristine) {
      playBeep();
      setIsPristine(false);
    }
    setIsActive(true);
  };

  // Pause timer
  const handlePause = () => {
    setIsActive(false);
  };

  // Reset timer
  const handleReset = () => {
    setIsActive(false);
    setTimeRemaining(sessionDuration);
    setIsPristine(true);
    setCompletedMatchups([]);
  };

  // New session
  const handleNewSession = () => {
    setSessionStarted(false);
    setIsActive(false);
    setIsPristine(true);
    setTimeRemaining(0);
    setSessionDuration(0);
    setCompletedMatchups([]);
    setShowCustomConfig(false);
  };

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Current round number
  const currentRound = Math.floor((sessionDuration - timeRemaining) / roundDuration) + 1;
  const totalRounds = sessionDuration / roundDuration;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-500 to-white">
      <header className="flex flex-col items-center justify-center pt-12 pb-8 px-4">
        <div className="flex items-center gap-8 mb-4">
          <img
            src="/f580035d-5821-45d8-8071-cd34d3b586b4_20251006_163403_0000.png"
            alt="Coach Paul"
            className="w-48 h-auto drop-shadow-2xl"
          />
          <h1
            className="text-7xl font-bold text-white drop-shadow-lg"
            style={{
              fontFamily: "'Brush Script MT', 'Lucida Handwriting', 'Apple Chancery', cursive",
              fontStyle: 'italic',
              letterSpacing: '2px'
            }}
          >
            Coach Paul
          </h1>
        </div>
        <p className="text-white text-xl font-semibold drop-shadow-md">
          Coach Paul's Wrestling Sparring Timer
        </p>
      </header>

      <main className="max-w-7xl mx-auto px-4 pb-12">
        {!sessionStarted ? (
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-3xl mx-auto">
            <div className="mb-8">
              <label className="block text-gray-700 text-lg font-semibold mb-3">
                <Users className="inline mr-2 mb-1" size={24} />
                Total Number of Wrestlers
              </label>
              <input
                type="number"
                min="3"
                value={totalWrestlers}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setTotalWrestlers('');
                  } else {
                    const num = parseInt(val);
                    setTotalWrestlers(isNaN(num) ? '' : Math.max(0, num));
                  }
                }}
                onBlur={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setTotalWrestlers(3);
                  } else {
                    const num = parseInt(val);
                    if (isNaN(num) || num < 3) {
                      setTotalWrestlers(3);
                    }
                  }
                }}
                className="w-full px-4 py-3 border-2 border-red-300 rounded-lg text-xl focus:outline-none focus:border-red-600"
              />
            </div>

            <div className="mb-8">
              <label className="block text-gray-700 text-lg font-semibold mb-3">
                Round Duration
              </label>
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => setRoundDuration(60)}
                  className={`px-6 py-4 rounded-lg font-semibold text-lg border-2 transition-colors ${
                    roundDuration === 60
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-red-400'
                  }`}
                >
                  1 Minute
                </button>
                <button
                  onClick={() => setRoundDuration(120)}
                  className={`px-6 py-4 rounded-lg font-semibold text-lg border-2 transition-colors ${
                    roundDuration === 120
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-red-400'
                  }`}
                >
                  2 Minutes
                </button>
                <button
                  onClick={() => setRoundDuration(180)}
                  className={`px-6 py-4 rounded-lg font-semibold text-lg border-2 transition-colors ${
                    roundDuration === 180
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-red-400'
                  }`}
                >
                  3 Minutes
                </button>
              </div>
            </div>

            {!showCustomConfig ? (
              <div>
                <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6 mb-6">
                  <h3 className="text-xl font-bold text-blue-900 mb-3">Recommended Configuration</h3>
                  <p className="text-blue-800 mb-4">{recommendation.explanation}</p>
                  <div className="text-lg font-semibold text-blue-900">
                    <p>{recommendation.groups3} groups of 3 wrestlers</p>
                    <p>{recommendation.groups4} groups of 4 wrestlers</p>
                    <p className="mt-2 text-sm text-blue-700">
                      Total Duration: {((recommendation.groups4 > 0 ? 6 : 3) * roundDuration) / 60} minutes
                      ({recommendation.groups4 > 0 ? 6 : 3} rounds × {roundDuration / 60} {roundDuration === 60 ? 'minute' : 'minutes'})
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={startWithRecommendation}
                    className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg font-semibold text-lg hover:bg-red-700 transition-colors"
                  >
                    Use Recommended
                  </button>
                  <button
                    onClick={() => {
                      setShowCustomConfig(true);
                      setGroupsOf3(recommendation.groups3);
                      setGroupsOf4(recommendation.groups4);
                    }}
                    className="flex-1 bg-white text-red-600 px-6 py-3 rounded-lg font-semibold text-lg border-2 border-red-600 hover:bg-red-50 transition-colors"
                  >
                    Customize Instead
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Number of 3-Person Groups
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={groupsOf3}
                      onChange={(e) => setGroupsOf3(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-4 py-3 border-2 border-red-300 rounded-lg text-lg focus:outline-none focus:border-red-600"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Number of 4-Person Groups
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={groupsOf4}
                      onChange={(e) => setGroupsOf4(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-4 py-3 border-2 border-red-300 rounded-lg text-lg focus:outline-none focus:border-red-600"
                    />
                  </div>
                </div>

                {isValidConfig ? (
                  <div className="bg-green-50 border-2 border-green-400 rounded-lg p-4 mb-6 flex items-center gap-3">
                    <span className="text-green-600 text-2xl">✓</span>
                    <p className="text-green-800 font-semibold">
                      Valid configuration! Total: {(groupsOf3 * 3) + (groupsOf4 * 4)} wrestlers
                      {' | Duration: '}{((groupsOf4 > 0 ? 6 : 3) * roundDuration) / 60} minutes
                      ({groupsOf4 > 0 ? 6 : 3} rounds × {roundDuration / 60} {roundDuration === 60 ? 'minute' : 'minutes'})
                    </p>
                  </div>
                ) : (
                  <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4 mb-6 flex items-center gap-3">
                    <span className="text-red-600 text-2xl">⚠</span>
                    <p className="text-red-800 font-semibold">
                      Invalid: Total is {(groupsOf3 * 3) + (groupsOf4 * 4)} but needs to be {totalWrestlers}
                    </p>
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    onClick={startWithCustom}
                    disabled={!isValidConfig}
                    className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg font-semibold text-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Start Session
                  </button>
                  <button
                    onClick={() => setShowCustomConfig(false)}
                    className="flex-1 bg-white text-red-600 px-6 py-3 rounded-lg font-semibold text-lg border-2 border-red-600 hover:bg-red-50 transition-colors"
                  >
                    Back to Recommendation
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Timer Display */}
            <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
              <div className="text-red-600 text-8xl font-bold mb-4">
                {formatTime(timeRemaining)}
              </div>
              <div className="text-gray-600 text-xl mb-6">
                Round {currentRound} of {totalRounds}
                {timeRemaining === 0 && (
                  <span className="block text-green-600 font-bold mt-2 text-2xl">Session Complete!</span>
                )}
              </div>

              {/* Controls */}
              <div className="flex justify-center gap-4">
                {!isActive ? (
                  <button
                    onClick={handleStart}
                    disabled={timeRemaining === 0}
                    className="bg-green-600 text-white px-8 py-4 rounded-lg font-semibold text-xl hover:bg-green-700 transition-colors flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    <Play size={24} />
                    {isPristine ? 'Start' : 'Resume'}
                  </button>
                ) : (
                  <button
                    onClick={handlePause}
                    className="bg-yellow-500 text-white px-8 py-4 rounded-lg font-semibold text-xl hover:bg-yellow-600 transition-colors flex items-center gap-2"
                  >
                    <Pause size={24} />
                    Pause
                  </button>
                )}
                <button
                  onClick={handleReset}
                  disabled={isPristine}
                  className="bg-red-600 text-white px-8 py-4 rounded-lg font-semibold text-xl hover:bg-red-700 transition-colors flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <RotateCcw size={24} />
                  Reset
                </button>
                <button
                  onClick={handleNewSession}
                  className="bg-red-600 text-white px-8 py-4 rounded-lg font-semibold text-xl hover:bg-red-700 transition-colors"
                >
                  New Session
                </button>
              </div>
            </div>

            {/* Current Round Display */}
            {timeRemaining > 0 && (
              <div className="bg-white rounded-2xl shadow-2xl p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Current Round</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentMatchups.map((matchup, idx) => (
                    <div key={idx} className="bg-white border-l-4 border-red-600 rounded-lg p-6 shadow-lg">
                      <div className="text-gray-600 font-semibold mb-3">
                        {matchup.count} groups of {matchup.groupType} wrestlers
                      </div>
                      <div className="text-2xl font-bold text-gray-900 mb-2">
                        Wrestling: #{matchup.wrestlers}
                      </div>
                      <div className="text-lg text-gray-600">
                        Resting: #{matchup.resting}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Match History */}
            {completedMatchups.length > 0 && (
              <div className="bg-white rounded-2xl shadow-2xl p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Match History</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {completedMatchups.map((match, idx) => (
                    <div key={idx} className="bg-green-50 border border-green-300 rounded-lg p-4">
                      <div className="text-green-700 text-sm font-semibold mb-1">
                        {match.size}-person group
                      </div>
                      <div className="text-gray-900 font-bold">
                        ✓ {match.matchup}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
