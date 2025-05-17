// src/App.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';

const DIFFICULTIES = {
  easy: { pairs: 6, time: 60 },
  medium: { pairs: 8, time: 45 },
  hard: { pairs: 10, time: 30 },
};

export default function App() {
  const [theme, setTheme] = useState('light');
  const [difficulty, setDifficulty] = useState('easy');
  const [allPokemons, setAllPokemons] = useState([]);
  const [pokedexDisplay, setPokedexDisplay] = useState([]);
  const [cards, setCards] = useState([]);
  const [flippedIds, setFlippedIds] = useState([]);
  const [matchedCount, setMatchedCount] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [powerUsed, setPowerUsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const timerRef = useRef();
  const observerRef = useRef();

  const BATCH_SIZE = 10;

  // Fetch initial Pokémon list and first batch
  useEffect(() => {
    fetch('https://pokeapi.co/api/v2/pokemon?limit=1500')
      .then((r) => r.json())
      .then((data) => {
        setAllPokemons(data.results);
        // Fetch only the first 10 Pokémon
        loadMorePokemons(data.results.slice(0, BATCH_SIZE)).then(() => {
          setLoading(false);
        });
      })
      .catch((error) => {
        console.error('Error fetching Pokémon list:', error);
        setLoading(false);
      });
  }, []);

  // Load Pokémon batch
  const loadMorePokemons = async (pokemons) => {
    try {
      const images = await Promise.all(
        pokemons.map((p) =>
          fetch(p.url)
            .then((r) => r.json())
            .then((d) => d.sprites.other['official-artwork'].front_default || d.sprites.front_default)
            .catch(() => null)
        )
      );
      const newPokedexData = pokemons.map((p, i) => ({
        name: p.name,
        img: images[i] || '',
      }));
      setPokedexDisplay((prev) => [...prev, ...newPokedexData]);
    } catch (error) {
      console.error('Error loading Pokémon batch:', error);
    }
  };

  // Intersection Observer for infinite scroll
  const lastPokemonElementRef = useCallback(
    (node) => {
      if (loading || !hasMore) return;
      if (observerRef.current) observerRef.current.disconnect();
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore) {
            const nextBatchStart = pokedexDisplay.length;
            const nextBatch = allPokemons.slice(nextBatchStart, nextBatchStart + BATCH_SIZE);
            if (nextBatch.length > 0) {
              setLoading(true);
              loadMorePokemons(nextBatch).then(() => setLoading(false));
            } else {
              setHasMore(false);
            }
          }
        },
        { threshold: 0.1 }
      );
      if (node) observerRef.current.observe(node);
    },
    [loading, hasMore, pokedexDisplay.length, allPokemons]
  );

  // Timer effect
  useEffect(() => {
    if (!running) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setGameOver(true);
          setRunning(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [running]);

  // Start or restart the game
  const startGame = async () => {
    resetGame();
    const { pairs, time } = DIFFICULTIES[difficulty];
    setTimeLeft(time);

    const sample = shuffle(allPokemons).slice(0, pairs);
    const images = await Promise.all(
      sample.map((p) =>
        fetch(p.url)
          .then((r) => r.json())
          .then((d) => d.sprites.other['official-artwork'].front_default || d.sprites.front_default)
          .catch(() => null)
      )
    );

    const deck = [];
    sample.forEach((p, i) => {
      const img = images[i] || '';
      deck.push({ id: `${p.name}-1`, key: p.name, img, flipped: false, matched: false });
      deck.push({ id: `${p.name}-2`, key: p.name, img, flipped: false, matched: false });
    });

    setCards(shuffle(deck));
    setRunning(true);
  };

  const resetGame = () => {
    clearInterval(timerRef.current);
    setCards([]);
    setFlippedIds([]);
    setMatchedCount(0);
    setClicks(0);
    setGameOver(false);
    setGameWon(false);
    setPowerUsed(false);
    setRunning(false);
  };

  const handleCardClick = (idx) => {
    if (!running || gameOver) return;
    const c = cards[idx];
    if (c.flipped || c.matched || flippedIds.length === 2) return;

    const newCards = [...cards];
    newCards[idx] = { ...c, flipped: true };
    setCards(newCards);
    const newFlipped = [...flippedIds, idx];
    setFlippedIds(newFlipped);

    if (newFlipped.length === 2) {
      setClicks(clicks + 1);
      const [i1, i2] = newFlipped;
      if (newCards[i1].key === newCards[i2].key) {
        newCards[i1].matched = newCards[i2].matched = true;
        setCards(newCards);
        setMatchedCount((m) => {
          const next = m + 1;
          if (next === DIFFICULTIES[difficulty].pairs) {
            setGameWon(true);
            setRunning(false);
            clearInterval(timerRef.current);
          }
          return next;
        });
        setFlippedIds([]);
      } else {
        setTimeout(() => {
          newCards[i1].flipped = newCards[i2].flipped = false;
          setCards([...newCards]);
          setFlippedIds([]);
        }, 800);
      }
    }
  };

  const triggerPower = () => {
    if (powerUsed || !running) return;
    setPowerUsed(true);
    const reveal = cards.map((c) => ({ ...c, flipped: true }));
    setCards(reveal);
    setTimeout(() => {
      const hide = reveal.map((c) => (c.matched ? c : { ...c, flipped: false }));
      setCards(hide);
    }, 3000);
  };

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  return (
    <div className={`app bg-${theme}`}>
      <header className="container py-4">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h1 className="h3 m-0">Pokémon Memory Match</h1>
          <div>
            <button
              className="btn btn-outline-secondary me-2"
              onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            >
              {theme === 'light' ? 'Dark' : 'Light'} Mode
            </button>
            <button
              className="btn btn-primary me-2"
              onClick={startGame}
              disabled={running || loading}
            >
              {loading ? 'Loading…' : running ? 'Restart' : 'Start'}
            </button>
            <button className="btn btn-secondary me-2" onClick={resetGame}>
              Reset
            </button>
            <button
              className="btn btn-info"
              onClick={triggerPower}
              disabled={powerUsed || !running}
            >
              🔍 Power-Up
            </button>
          </div>
        </div>

        <div className="row gx-3">
          <div className="col-auto">
            <FormGroup>
              <label className="form-label mb-1">Difficulty</label>
              <select
                className="form-select"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                disabled={running}
              >
                {Object.keys(DIFFICULTIES).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </FormGroup>
          </div>
          <div className="col">
            <ul className="list-inline mb-0">
              <li className="list-inline-item">
                Time: <strong>{timeLeft}s</strong>
              </li>
              <li className="list-inline-item">
                Clicks: <strong>{clicks}</strong>
              </li>
              <li className="list-inline-item">
                Matched: <strong>{matchedCount}</strong>
              </li>
              <li className="list-inline-item">
                Left: <strong>{DIFFICULTIES[difficulty].pairs - matchedCount}</strong>/
                {DIFFICULTIES[difficulty].pairs}
              </li>
            </ul>
          </div>
        </div>
      </header>

      {/* POKEDEX SHOWCASE */}
      <div className="container">
        <section className="pokemon-showcase mb-4">
          <h2 className="h5">Pokédex</h2>
          <div className="showcase-grid">
            {pokedexDisplay.map((p, i) => (
              <div
                key={`${p.name}-${i}`}
                className="showcase-card"
                ref={i === pokedexDisplay.length - 1 ? lastPokemonElementRef : null}
              >
                <img src={p.img} alt={p.name} className="showcase-img" loading="lazy" />
                <div>{p.name}</div>
              </div>
            ))}
            {loading && <div>Loading...</div>}
            {!hasMore && pokedexDisplay.length > 0 && <div>No more Pokémon to load</div>}
          </div>
        </section>
      </div>

      {/* GAME OVERLAY */}
      {gameOver && <div className="overlay">Game Over!</div>}
      {gameWon && <div className="overlay">You Win! 🎉</div>}

      {/* MEMORY GRID - Conditionally rendered */}
      {cards.length > 0 && (
        <div className="container grid">
          {cards.map((c, idx) => (
            <div
              key={c.id}
              className={`card ${c.flipped || c.matched ? 'flipped' : ''}`}
              onClick={() => handleCardClick(idx)}
            >
              {c.flipped || c.matched ? (
                <img src={c.img} alt={c.key} />
              ) : (
                <div className="back" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FormGroup({ children }) {
  return <div className="mb-3">{children}</div>;
}