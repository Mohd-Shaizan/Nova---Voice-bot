'use client';

import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import PropTypes from 'prop-types';
import { EffectComposer, Bloom } from '@react-three/postprocessing';


// SubtitleDisplay component
const SubtitleDisplay = memo(({ isVisible, userTranscript, novaWords }) => {
  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '15px',
      borderRadius: '10px',
      backgroundColor: 'rgba(0,0,0,0.8)',
      border: '2px solid #00FFAA',
      minWidth: '300px',
      maxWidth: '500px',
      width: '80%',
      maxHeight: '80px',
      overflow: 'hidden',
      fontFamily: '"Orbitron", sans-serif',
      backdropFilter: 'blur(5px)',
      opacity: isVisible ? 1 : 0,
      transition: 'opacity 0.3s ease-in-out',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      zIndex: 1000, // keep it outside canvas rendering flow
      pointerEvents: 'none'
    }}>
      {userTranscript && (
        <div style={{ 
          color: '#00FF00',
          marginBottom: '10px',
          textAlign: 'left',
          wordBreak: 'break-word',
        }}>
          <strong>You:</strong> {userTranscript}
        </div>
      )}
      {novaWords.length > 0 && (
        <div style={{ 
          color: '#00FFFF',
          textAlign: 'left',
          wordBreak: 'break-word',
        }}>
          <strong>Nova:</strong> {novaWords.join(' ')}
          <span style={{ opacity: 0.7 }}>▋</span>
        </div>
      )}
    </div>
  );
});


// Components
const Dot = ({ initialPosition, targetPosition, animationState, mousePosition, particleColor }) => {
  const meshRef = useRef();
  const prevState = useRef(animationState);
  const spherePosition = useRef(new THREE.Vector3(...initialPosition));
  const materialRef = useRef();
  const progress = useRef(0);

  useFrame(() => {
    const currentPosition = meshRef.current.position;

    if (prevState.current !== animationState) {
      progress.current = 0;
      prevState.current = animationState;
    }

    progress.current = Math.min(progress.current + 0.05, 1);

    switch (animationState) {
      case 'sphere':
        currentPosition.lerpVectors(
          new THREE.Vector3(...initialPosition),
          targetPosition,
          progress.current
        );
        spherePosition.current.copy(currentPosition);
        break;
      case 'wave':
        const waveTarget = new THREE.Vector3(
          targetPosition.x + Math.sin(Date.now() * 0.0001 + targetPosition.y * 2) * 0.2,
          targetPosition.y + Math.cos(Date.now() * 0.004 + targetPosition.x * 3) * 0.2,
          targetPosition.z + Math.sin(Date.now() * 0.0001 + targetPosition.y * 1) * 0.2
        );
        currentPosition.lerp(waveTarget, 0.2);
        break;
      case 'scattered':
        const targetScatter = new THREE.Vector3(...initialPosition);
        currentPosition.x += (targetScatter.x - currentPosition.x) * 0.1;
        currentPosition.y += (targetScatter.y - currentPosition.y) * 0.1;
        currentPosition.z += (targetScatter.z - currentPosition.z) * 0.1;
        currentPosition.x += Math.sin(Date.now() * 0.001 + initialPosition[0]) * 0.09;
        currentPosition.y += Math.cos(Date.now() * 0.001 + initialPosition[1]) * 0.1;

        if (mousePosition) {
          const distanceToMouse = currentPosition.distanceTo(mousePosition);
          if (distanceToMouse < 3) {
            const repulsionStrength = (2 - distanceToMouse) * 0.2;
            const direction = currentPosition.clone().sub(mousePosition).normalize();
            currentPosition.add(direction.multiplyScalar(repulsionStrength));
          }
        }
        break;
      default:
        break;
    }

    if (materialRef.current) {
      materialRef.current.color.copy(particleColor);
      materialRef.current.emissive.copy(particleColor);
      materialRef.current.emissiveIntensity = 1.5;
    }
  });

  return (
    <mesh ref={meshRef} position={initialPosition}>
      <sphereGeometry args={[0.0055, 32, 32]} />
      <meshStandardMaterial
        ref={materialRef}
        color={particleColor}
        emissive={particleColor}
        emissiveIntensity={1.5}
        toneMapped={false}
      />
    </mesh>
  );
};

const Scene = ({ animationState }) => {
  const groupRef = useRef();
  const { mouse, camera } = useThree();
  const dotCount = 2000;

  const colorPalette = useRef([
    new THREE.Color('#FF00FF'),
    new THREE.Color('#00FF00'),
    new THREE.Color('#00FFFF'),
    new THREE.Color('#FF00AA'),
    new THREE.Color('#FFFF00'),
    new THREE.Color('#39FF14'),
    new THREE.Color('#FF1493'),
    new THREE.Color('#7DF9FF'),
    new THREE.Color('#FF6EC7'),
    new THREE.Color('#DFFF00'),
  ]);

  const currentColor = useRef(colorPalette.current[0].clone());
  const targetColor = useRef(colorPalette.current[0].clone());
  const lastColorChange = useRef(0);
  const colorChangeInterval = 2;

  const getRandomColor = () => {
    const randomIndex = Math.floor(Math.random() * colorPalette.current.length);
    return colorPalette.current[randomIndex].clone();
  };

  const dots = useRef(
    Array.from({ length: dotCount }, (_, index) => ({
      id: `dot-${index}`,
      position: [(Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10],
    }))
  ).current;

  const radius = 1.5;
  const targetPositions = useRef(
    Array.from({ length: dotCount }, (_, i) => {
      const y = 1 - (i / (dotCount - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = ((1 + Math.sqrt(5)) / 2) * i * 2 * Math.PI;
      return new THREE.Vector3(
        Math.cos(theta) * radiusAtY * radius,
        y * radius,
        Math.sin(theta) * radiusAtY * radius
      );
    })
  ).current;

  useFrame((state) => {
    if ((animationState === 'sphere' || animationState === 'wave') && groupRef.current) {
      groupRef.current.rotation.y += 0.02;
      groupRef.current.rotation.x += 0.001;
    }

    const elapsedTime = state.clock.getElapsedTime();
    if (elapsedTime - lastColorChange.current >= colorChangeInterval) {
      targetColor.current = getRandomColor();
      lastColorChange.current = elapsedTime;
    }
    currentColor.current.lerp(targetColor.current, 0.02);
  });

  const mousePosition = useRef(new THREE.Vector3());
  useFrame(() => {
    mousePosition.current.set(mouse.x * 5, mouse.y * 5, 0).unproject(camera);
  });

  return (
    <group ref={groupRef}>
      {dots.map((dot, i) => (
        <Dot
          key={dot.id}
          initialPosition={dot.position}
          targetPosition={targetPositions[i]}
          animationState={animationState}
          mousePosition={mousePosition.current}
          particleColor={currentColor.current}
        />
      ))}
    </group>
  );
};

const NovaLogo = ({ transitionSpeed = 1500 }) => {
  const [glowColor, setGlowColor] = useState('#FF00FF');

  useEffect(() => {
    const colors = [
      '#FF00FF', '#00FF00', '#00FFFF', '#FF00AA', '#FFFF00', '#39FF14', '#FF1493', '#7DF9FF',
      '#FF6EC7', '#DFFF00', '#FF0033', '#00CED1', '#FFD700', '#FF4500', '#ADFF2F', '#8A2BE2',
      '#00BFFF', '#E100FF', '#FF007F', '#BFFF00', '#1E90FF', '#DC143C', '#FFB6C1', '#F5FFFA',
      '#C71585',
    ];
    let index = 0;

    const interval = setInterval(() => {
      index = (index + 1) % colors.length;
      setGlowColor(colors[index]);
    }, transitionSpeed);

    return () => clearInterval(interval);
  }, [transitionSpeed]);

  return (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 10,
        padding: '3px 5px',
        borderRadius: '10px',
        backgroundColor: 'rgba(0,0,0,0.7)',
        border: `2px solid ${glowColor}`,
        boxShadow: `0 0 15px ${glowColor}`,
        transition: `all ${transitionSpeed / 3000}s ease-in-out`,
      }}
    >
      <h1
        style={{
          color: glowColor,
          textShadow: `0 0 10px ${glowColor}`,
          transition: `all ${transitionSpeed / 3000}s ease-in-out`,
          fontSize: '2rem',
          fontFamily: '"Orbitron", sans-serif',
          margin: 0,
        }}
      >
        nova
      </h1>
    </div>
  );
};

const TimeDisplay = memo(() => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isClient) return <div style={{ visibility: 'hidden' }} />;

  return (
    <div
      style={{
        position: 'absolute',
        top: '30px',
        right: '30px',
        padding: '15px',
        borderRadius: '10px',
        backgroundColor: 'rgba(0,0,0,0.7)',
        border: '2px solid #00FFFF',
        textAlign: 'center',
        zIndex: 10,
        minWidth: '200px',
        fontFamily: '"Orbitron", sans-serif',
      }}
    >
      <div style={{ fontSize: '1.5rem', color: '#00FFFF', fontWeight: 'bold' }}>
        {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
      </div>
      <div style={{ fontSize: '1rem', color: '#FFFFFF' }}>
        {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
      </div>
    </div>
  );
});

const WeatherDisplay = () => {
  const [weatherData, setWeatherData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const position = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 60000 })
        );

        const response = await fetch(
          `https://api.weatherapi.com/v1/current.json?key=8cce782cb85942cbaab121643251404&q=${position.coords.latitude},${position.coords.longitude}&aqi=no`
        );

        if (!response.ok) throw new Error('Failed to fetch weather data');

        const data = await response.json();
        setWeatherData({
          location: `${data.location.name}, ${data.location.country}`,
          temp: data.current.temp_c,
          condition: data.current.condition.text,
          icon: `https:${data.current.condition.icon}`,
          humidity: data.current.humidity,
          precip: data.current.precip_mm,
          windSpeed: data.current.wind_kph,
          windDir: data.current.wind_dir,
          pressure: data.current.pressure_mb,
        });
        setError(null);
      } catch (err) {
        console.error('Weather fetch error:', err);
        try {
          const fallbackResponse = await fetch(
            `https://api.weatherapi.com/v1/current.json?key=8cce782cb85942cbaab121643251404&q=New York&aqi=no`
          );
          const fallbackData = await fallbackResponse.json();
          setWeatherData({
            location: `${fallbackData.location.name}, ${fallbackData.location.country}`,
            temp: fallbackData.current.temp_c,
            condition: fallbackData.current.condition.text,
            icon: `https:${fallbackData.current.condition.icon}`,
            humidity: fallbackData.current.humidity,
            precip: fallbackData.current.precip_mm,
            windSpeed: fallbackData.current.wind_kph,
            windDir: fallbackData.current.wind_dir,
            pressure: fallbackData.current.pressure_mb,
          });
          setError('Using New York as fallback due to location access issue.');
        } catch (fallbackErr) {
          setError('Unable to fetch weather data. Please enable location access.');
        }
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        top: '170px',
        right: '30px',
        padding: '10px',
        borderRadius: '10px',
        backgroundColor: 'rgba(0,0,0,0.7)',
        border: '2px solid #00FFAA',
        textAlign: 'center',
        color: 'white',
        fontFamily: '"Orbitron", sans-serif',
        minWidth: '220px',
        zIndex: 10,
      }}
    >
      {weatherData ? (
        <>
          <div style={{ fontSize: '1rem', color: '#00FFAA', fontWeight: 'bold', marginBottom: '8px' }}>
            {weatherData.location}
          </div>
          <div style={{ display: 'flex', alignItems: 'right', gap: '1px', marginBottom: '8px', marginLeft: '54px' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{weatherData.temp}°C</span>
            <img src={weatherData.icon} alt="Weather icon" style={{ width: '30px', height: '30px' }} />
          </div>
          <div style={{ fontSize: '0.9rem', color: '#CCCCCC', marginBottom: '5px' }}>
            {weatherData.condition}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#FFFFFF', marginBottom: '5px' }}>
            Humidity: {weatherData.humidity}%
          </div>
          <div style={{ fontSize: '0.9rem', color: '#FFFFFF', marginBottom: '5px' }}>
            Precipitation: {weatherData.precip} mm
          </div>
          <div style={{ fontSize: '0.9rem', color: '#FFFFFF', marginBottom: '5px' }}>
            Wind: {weatherData.windSpeed} kph {weatherData.windDir}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#FFFFFF' }}>
            Pressure: {weatherData.pressure} hPa
          </div>
        </>
      ) : (
        <div style={{ fontSize: '1rem', color: '#FFFFFF' }}>
          {error || 'Loading weather...'}
        </div>
      )}
    </div>
  );
};

const SystemStatus = () => {
  const [isClient, setIsClient] = useState(false);
  const [systemData, setSystemData] = useState({
    battery: 0,
    ramUsage: 0,
    cpuUsage: 0,
    cpuCores: 0,
    os: 'Unknown',
    charging: false,
    screenResolution: 'Unknown',
    onlineStatus: false,
    memory: { total: 0, used: 0 },
    darkMode: false,
  });

  useEffect(() => {
    setIsClient(true);

    function getOS() {
      const userAgent = window.navigator.userAgent;
      const platform = window.navigator.platform;
      const macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
      const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
      const iosPlatforms = ['iPhone', 'iPad', 'iPod'];
      if (macosPlatforms.includes(platform)) return 'macOS';
      if (windowsPlatforms.includes(platform)) return 'Windows';
      if (iosPlatforms.includes(platform)) return 'iOS';
      if (/Android/.test(userAgent)) return 'Android';
      if (/Linux/.test(platform)) return 'Linux';
      return 'Unknown';
    }

    function getScreenResolution() {
      return `${window.screen.width} × ${window.screen.height}`;
    }

    function getCPUCores() {
      return navigator.hardwareConcurrency || 'Unknown';
    }

    function getMemoryInfo() {
      const performanceMemory = window.performance?.memory;
      if (performanceMemory) {
        return {
          total: Math.round(performanceMemory.jsHeapSizeLimit / (1024 * 1024)),
          used: Math.round(performanceMemory.usedJSHeapSize / (1024 * 1024)),
        };
      }
      return { total: 0, used: 0 };
    }

    const updateBattery = async () => {
      if ('getBattery' in navigator) {
        try {
          const battery = await navigator.getBattery();
          const updateBatteryStatus = () => {
            setSystemData((prev) => ({
              ...prev,
              battery: Math.round(battery.level * 100),
              charging: battery.charging,
            }));
          };
          updateBatteryStatus();
          battery.addEventListener('levelchange', updateBatteryStatus);
          battery.addEventListener('chargingchange', updateBatteryStatus);
          return () => {
            battery.removeEventListener('levelchange', updateBatteryStatus);
            battery.removeEventListener('chargingchange', updateBatteryStatus);
          };
        } catch (error) {
          console.error('Battery API error:', error);
        }
      }
    };

    setSystemData((prev) => ({
      ...prev,
      os: getOS(),
      screenResolution: getScreenResolution(),
      cpuCores: getCPUCores(),
      onlineStatus: navigator.onLine,
      memory: getMemoryInfo(),
      darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
    }));

    const updateOnlineStatus = () => {
      setSystemData((prev) => ({ ...prev, onlineStatus: navigator.onLine }));
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    let animationFrame;
    let lastUpdate = 0;
    const updateUsage = (timestamp) => {
      if (timestamp - lastUpdate > 1000) {
        const memoryInfo = getMemoryInfo();
        setSystemData((prev) => ({
          ...prev,
          cpuUsage: Math.round(10 + Math.sin(Date.now() / 3000) * 10 + Math.random() * 15),
          ramUsage: Math.round((memoryInfo.used / memoryInfo.total) * 100) || Math.round(30 + Math.sin(Date.now() / 5000) * 15 + Math.random() * 10),
          memory: memoryInfo,
        }));
        lastUpdate = timestamp;
      }
      animationFrame = requestAnimationFrame(updateUsage);
    };
    animationFrame = requestAnimationFrame(updateUsage);

    updateBattery();

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  if (!isClient) return <div style={{ visibility: 'hidden' }} />;

  return (
    <div
      style={{
        position: 'absolute',
        top: '150px',
        left: '20px',
        padding: '15px',
        borderRadius: '10px',
        backgroundColor: 'rgba(0,0,0,0.7)',
        border: '2px solid #E100FF',
        textAlign: 'left',
        zIndex: 10,
        minWidth: '250px',
        fontFamily: '"Orbitron", sans-serif',
        color: 'white',
        backdropFilter: 'blur(5px)',
      }}
    >
      <div style={{ fontSize: '1.2rem', color: '#E100FF', fontWeight: 'bold', marginBottom: '10px' }}>
        System Status
      </div>
      <div style={{ marginBottom: '8px' }}>
        <span style={{ color: '#00FFFF' }}>OS:</span> {systemData.os}
      </div>
      <div style={{ marginBottom: '8px' }}>
        <span style={{ color: '#00FFFF' }}>CPU:</span> {systemData.cpuUsage}% ({systemData.cpuCores} cores)
      </div>
      <div style={{ marginBottom: '8px' }}>
        <span style={{ color: '#00FFFF' }}>RAM:</span> {systemData.ramUsage}%
        {systemData.memory.total > 0 && (
          <span> ({systemData.memory.used}MB / {systemData.memory.total}MB)</span>
        )}
      </div>
      {'getBattery' in navigator && (
        <div style={{ marginBottom: '8px' }}>
          <span style={{ color: '#00FFFF' }}>Battery:</span> {systemData.battery}%
          {systemData.charging && <span style={{ color: '#00FF00' }}> (Charging)</span>}
        </div>
      )}
      <div style={{ marginBottom: '8px' }}>
        <span style={{ color: '#00FFFF' }}>Network:</span>{' '}
        {systemData.onlineStatus ? (
          <span style={{ color: '#00FF00' }}> Online</span>
        ) : (
          <span style={{ color: '#FF0000' }}> Offline</span>
        )}
      </div>
    </div>
  );
};

const NewsHeadlines = () => {
  const [headlines, setHeadlines] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const dataFetchedRef = useRef(false);
  const rotationIntervalRef = useRef(null);
  const lastFetchTime = useRef(0);
  const fetchInterval = 5 * 60 * 1000;

  const FALLBACK_NEWS = [
    { title: 'Breaking: Technology advances in AI voice assistants', source: { name: 'Tech News' }, publishedAt: new Date().toISOString() },
    { title: 'Global summit on climate change concludes', source: { name: 'World News' }, publishedAt: new Date(Date.now() - 3600000).toISOString() },
    { title: 'New breakthroughs in quantum computing', source: { name: 'Science Daily' }, publishedAt: new Date(Date.now() - 7200000).toISOString() },
  ];

  const getCachedData = () => {
    const cachedData = localStorage.getItem('newsHeadlines');
    const cachedTime = localStorage.getItem('newsHeadlinesTime');
    if (cachedData && cachedTime && Date.now() - parseInt(cachedTime) < fetchInterval) {
      return JSON.parse(cachedData);
    }
    return null;
  };

  const fetchNews = async () => {
    try {
      const API_KEY = 'YOUR_NEWS_API_KEY'; // Replace with actual key
      let articles = FALLBACK_NEWS;

      if (API_KEY) {
        const response = await fetch(`https://gnews.io/api/v4/top-headlines?token=${API_KEY}&lang=en&max=3`);
        if (!response.ok) throw new Error('Failed to fetch news');
        const data = await response.json();
        articles = data.articles || FALLBACK_NEWS;
      }

      setHeadlines(articles);
      localStorage.setItem('newsHeadlines', JSON.stringify(articles));
      localStorage.setItem('newsHeadlinesTime', Date.now().toString());
      lastFetchTime.current = Date.now();
    } catch (error) {
      console.error('News fetch error:', error);
      setHeadlines(FALLBACK_NEWS);
      localStorage.setItem('newsHeadlines', JSON.stringify(FALLBACK_NEWS));
      localStorage.setItem('newsHeadlinesTime', Date.now().toString());
      lastFetchTime.current = Date.now();
    }
  };

  useEffect(() => {
    if (!dataFetchedRef.current) {
      const cachedData = getCachedData();
      if (cachedData) {
        setHeadlines(cachedData);
        lastFetchTime.current = parseInt(localStorage.getItem('newsHeadlinesTime'));
      } else {
        fetchNews();
      }
      dataFetchedRef.current = true;

      const interval = setInterval(() => {
        if (Date.now() - lastFetchTime.current >= fetchInterval) {
          fetchNews();
        }
      }, 60000);

      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    if (headlines.length > 1) {
      rotationIntervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % headlines.length);
      }, 15000);
      return () => {
        if (rotationIntervalRef.current) clearInterval(rotationIntervalRef.current);
      };
    }
  }, [headlines.length]);

  const formatTime = (dateString) => {
    const diff = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  const currentHeadline = headlines[currentIndex] || headlines[0];

  return (
    <div
      style={{
        position: 'absolute',
        top: '430px',
        right: '30px',
        padding: '10px',
        borderRadius: '10px',
        backgroundColor: 'rgba(0,0,0,0.7)',
        border: '2px solid #00FF00',
        textAlign: 'center',
        zIndex: 10,
        minWidth: '200px',
        maxWidth: '220px',
        minHeight: '50px',
        fontFamily: '"Orbitron", sans-serif',
        color: 'white',
        backdropFilter: 'blur(5px)',
      }}
    >
      <div style={{ fontSize: '1.2rem', color: '#00FF99', fontWeight: 'bold', marginBottom: '8px' }}>
        Latest News
      </div>
      {headlines.length > 0 ? (
        currentHeadline && (
          <>
            <div style={{ margin: '8px 0', transition: 'opacity 0.5s ease' }}>
              <div style={{ fontSize: '0.95rem', lineHeight: '1.4', marginBottom: '5px' }}>
                {currentHeadline.title}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#AAAAAA' }}>
                <span>{currentHeadline.source?.name || 'Unknown source'}</span>
                <span>{formatTime(currentHeadline.publishedAt)}</span>
              </div>
            </div>
            {headlines.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '25px' }}>
                {headlines.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: i === currentIndex ? '#00FF99' : '#444444',
                      cursor: 'pointer',
                      transition: 'background-color 0.3s',
                    }}
                    onClick={() => setCurrentIndex(i)}
                  />
                ))}
              </div>
            )}
          </>
        )
      ) : (
        <div style={{ fontSize: '0.9rem', color: '#FFFFFF', opacity: 0.7 }}>Loading news...</div>
      )}
    </div>
  );
};

const VoiceBotWithAnimations = () => {
  const [animationState, setAnimationState] = useState('scattered');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [displayedResponse, setDisplayedResponse] = useState('');
  const recognitionRef = useRef(null);
  const [pixelRatio, setPixelRatio] = useState(1);
  const animationTimeout = useRef(null);
  const [isClient, setIsClient] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [showOverlay, setShowOverlay] = useState(true);
  const [showInteractionPrompt, setShowInteractionPrompt] = useState(true);
  const [displayMode, setDisplayMode] = useState('idle'); // 'idle' | 'userSpeaking' | 'novaSpeaking'
  const [currentDisplayText, setCurrentDisplayText] = useState('');
  const [displayedWords, setDisplayedWords] = useState([]);
  const [userTranscript, setUserTranscript] = useState('');
  const [novaResponse, setNovaResponse] = useState('');
  const [displayedNovaWords, setDisplayedNovaWords] = useState([]);
  const wordBatchIntervalRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastAnimationTime = useRef(0);
  const [isShowingResponse, setIsShowingResponse] = useState(false);
  const responseTimeoutRef = useRef(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const animate = useCallback((time) => {
    if (!lastAnimationTime.current) lastAnimationTime.current = time;
    const deltaTime = time - lastAnimationTime.current;
    lastAnimationTime.current = time;

    animationFrameRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [animate]);

  useEffect(() => {
    return () => {
      if (wordBatchIntervalRef.current) clearInterval(wordBatchIntervalRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
          const speechResult = event.results[0][0].transcript.toLowerCase();
          setTranscript(speechResult);
          setStatus('Processing');
          processCommand(speechResult);
        };

        recognition.onend = () => {
          setIsListening(false);
          setStatus(isSpeaking ? 'Speaking' : 'Idle');
        };

        recognition.onerror = (event) => {
          console.error('Speech Recognition Error:', event.error);
          setIsListening(false);
          setStatus('Idle');
          speak('Sorry, I couldn’t understand that. Please try again.');
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (animationTimeout.current) clearTimeout(animationTimeout.current);
    };
  }, []);

  useEffect(() => {
    setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }, []);

  useEffect(() => {
    if (isListening && !isSpeaking) {
      setAnimationState('sphere');
      setStatus('Listening');
    } else if (isSpeaking) {
      setAnimationState('wave');
      setStatus('Speaking');
    } else if (!isListening && !isSpeaking) {
      animationTimeout.current = setTimeout(() => {
        setAnimationState('scattered');
        setStatus('Idle');
      }, 300);
    }

    return () => {
      if (animationTimeout.current) clearTimeout(animationTimeout.current);
    };
  }, [isListening, isSpeaking]);

  
  const displayedNovaWordsRef = useRef([]);

const speak = (text, rate = 2.5) => {
  if (typeof window === 'undefined') return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = rate;

  utterance.onstart = () => {
    setIsSpeaking(true);
    setStatus('Speaking');
    setTranscript('');
    setUserTranscript('');
    displayedNovaWordsRef.current = [];
    setDisplayedNovaWords([]);
    setIsShowingResponse(true);

    const words = text.split(' ');
    let currentIndex = 0;

    const showWords = () => {
      if (currentIndex < words.length) {
        const batchSize = 2 + Math.floor(Math.random() * 3);
        const batch = words.slice(currentIndex, currentIndex + batchSize);
        displayedNovaWordsRef.current.push(...batch);
        setDisplayedNovaWords([...displayedNovaWordsRef.current]);
        currentIndex += batch.length;
        wordBatchIntervalRef.current = setTimeout(showWords, 350); // Reduce frame choke
      }
    };

    showWords();
  };

  utterance.onend = () => {
    setIsSpeaking(false);
    setStatus(isListening ? 'Listening' : 'Idle');
    if (wordBatchIntervalRef.current) clearTimeout(wordBatchIntervalRef.current);
    responseTimeoutRef.current = setTimeout(() => {
      setIsShowingResponse(false);
      setDisplayedNovaWords([]);
      displayedNovaWordsRef.current = [];
    }, 500);
  };

  window.speechSynthesis.speak(utterance);
};


  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      setUserTranscript('');
      setNovaResponse('');
      recognitionRef.current.start();
    }
  };

  useEffect(() => {
    if (transcript) {
      setUserTranscript(transcript);
    }
  }, [transcript]);

  useEffect(() => {
    if (displayMode === 'novaSpeaking') {
      setCurrentDisplayText('');
    }
  }, [displayMode]);

  const getTimeBasedGreeting = () => {
    const hours = new Date().getHours();
    if (hours >= 5 && hours < 12) return 'Good morning';
    if (hours >= 12 && hours < 17) return 'Good afternoon';
    if (hours >= 17 && hours < 21) return 'Good evening';
    return 'Good night';
  };

  const getCurrentTime = () => new Date().toLocaleTimeString();
  const getCurrentDate = () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const processCommand = async (command) => {
    if (command.includes('hello') || command.includes('good morning') || command.includes('hi')) {
      speak('Hello, I am Nova. How can I assist you today?');
      return;
    }

    if (command.includes('exit') || command.includes('goodbye')) {
      speak('Goodbye! Have a nice day!');
      setIsListening(false);
      return;
    }

    const commands = [
      {
        condition: (cmd) => cmd.includes('time'),
        action: () => speak(`The current time is ${getCurrentTime()}.`),
      },
      {
        condition: (cmd) => cmd.includes('date'),
        action: () => speak(`Today's date is ${getCurrentDate()}.`),
      },
      {
        condition: (cmd) => cmd.includes('day') && cmd.includes('what') && !cmd.includes('yesterday') && !cmd.includes('tomorrow'),
        action: () => {
          const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
          speak(`Today is ${today}.`);
        },
      },
      {
        condition: (cmd) => cmd.includes('weather') || cmd.includes('temperature'),
        action: async () => {
          try {
            const position = await new Promise((resolve, reject) =>
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 60000 })
            );

            const response = await fetch(
              `https://api.weatherapi.com/v1/current.json?key=8cce782cb85942cbaab121643251404&q=${position.coords.latitude},${position.coords.longitude}&aqi=no`
            );

            if (!response.ok) throw new Error('API request failed');

            const data = await response.json();
            const location = data.location.name;
            const temp = data.current.temp_c;
            const condition = data.current.condition.text;
            const wind = data.current.wind_kph;
            const humidity = data.current.humidity;
            const precip = data.current.precip_mm;
            const pressure = data.current.pressure_mb;

            speak(
              `Current weather in ${location}: ${condition}, ${temp} degrees Celsius, ` +
              `humidity ${humidity} percent, precipitation ${precip} millimeters, ` +
              `wind ${wind} kilometers per hour, pressure ${pressure} hectopascals`
            );
          } catch (error) {
            console.error('Weather fetch error:', error);
            if (error.code === error.PERMISSION_DENIED) {
              speak('Please enable location access to get local weather.');
            } else if (error.code === error.TIMEOUT) {
              speak('Location detection timed out. Trying New York weather...');
              const fallbackResponse = await fetch(
                `https://api.weatherapi.com/v1/current.json?key=8cce782cb85942cbaab121643251404&q=New York&aqi=no`
              );
              const fallbackData = await fallbackResponse.json();
              speak(
                `New York weather: ${fallbackData.current.condition.text}, ` +
                `${fallbackData.current.temp_c} degrees Celsius, ` +
                `humidity ${fallbackData.current.humidity} percent`
              );
            } else {
              speak("Sorry, I couldn't fetch weather data. Please try again later.");
            }
          }
        },
      },
      {
        condition: (cmd) => cmd.includes('plus') || cmd.includes('+'),
        action: () => {
          const numbers = command.match(/\d+/g);
          if (numbers && numbers.length >= 2) {
            const sum = parseFloat(numbers[0]) + parseFloat(numbers[1]);
            speak(`${numbers[0]} plus ${numbers[1]} equals ${sum}.`);
          } else {
            speak('Please provide two numbers to add.');
          }
        },
      },
      {
        condition: (cmd) => cmd.includes('minus') || cmd.includes('-'),
        action: () => {
          const numbers = command.match(/\d+/g);
          if (numbers && numbers.length >= 2) {
            const difference = parseFloat(numbers[0]) - parseFloat(numbers[1]);
            speak(`${numbers[0]} minus ${numbers[1]} equals ${difference}.`);
          } else {
            speak('Please provide two numbers to subtract.');
          }
        },
      },
      {
        condition: (cmd) => cmd.includes('multiplied') || cmd.includes('*'),
        action: () => {
          const numbers = command.match(/\d+/g);
          if (numbers && numbers.length >= 2) {
            const product = parseFloat(numbers[0]) * parseFloat(numbers[1]);
            speak(`${numbers[0]} times ${numbers[1]} equals ${product}.`);
          } else {
            speak('Please provide two numbers to multiply.');
          }
        },
      },
      {
        condition: (cmd) => cmd.includes('divide') || cmd.includes('/'),
        action: () => {
          const numbers = command.match(/\d+/g);
          if (numbers && numbers.length >= 2) {
            const divisor = parseFloat(numbers[1]);
            if (divisor === 0) {
              speak("Sorry, I can't divide by zero.");
              return;
            }
            const quotient = parseFloat(numbers[0]) / divisor;
            speak(`${numbers[0]} divided by ${numbers[1]} equals ${quotient}.`);
          } else {
            speak('Please provide two numbers to divide.');
          }
        },
      },
      {
        condition: (cmd) => cmd.includes('who is') || cmd.includes('what is') || cmd.includes('how does')|| cmd.includes('what is the meaning of ')||cmd.includes('meaning of ')||cmd.includes('tell me about'),
        action: () => {
          const query = command
            .replace('who is', '')
            .replace('what is', '')
            .replace('how does', '')
            .replace('nova', '')
            .trim();
          if (query) {
            webSearch(query);
          } else {
            speak('Could you please repeat your question?');
          }
        },
      },
      {
        condition: (cmd) => cmd.includes('set a timer') || cmd.includes('timer for'),
        action: () => {
          const timeMatch = command.match(/\d+/);
          if (timeMatch) {
            const minutes = parseInt(timeMatch[0], 10);
            const seconds = minutes * 60;
            speak(`Setting a timer for ${minutes} minute${minutes > 1 ? 's' : ''}.`);
            setTimeout(() => {
              speak('Timer finished!');
            }, seconds * 1000);
          } else {
            speak('Please specify the number of minutes for the timer.');
          }
        },
      },
      {
        condition: (cmd) => cmd.includes('fun fact'),
        action: () => {
          const funFacts = [
            'Honey never spoils because it’s a natural preservative.',
            'A day on Venus is longer than a year on Venus.',
            'Bananas are berries, but strawberries aren’t.',
            'Octopuses have three hearts and can change color to blend into their surroundings.',
            'The smell of rain is caused by a bacteria called actinomycetes.',
          ];
          const randomFact = funFacts[Math.floor(Math.random() * funFacts.length)];
          speak(`Here’s a fun fact: ${randomFact}`);
        },
      },
      {
        condition: (cmd) => cmd.includes('hey nova') || cmd.includes('hello nova') || cmd.includes('hey innova'),
        action: () => {
          const greeting = getTimeBasedGreeting();
          speak(`${greeting}, I am Nova. How can I assist you today?`);
        },
      },
      {
        condition: (cmd) => cmd.includes('news headlines'),
        action: async () => {
          const headlines = await getNewsHeadlines();
          speak('Here are the top news headlines:');
          headlines.forEach((headline) => speak(headline));
        },
      },
      {
        condition: (cmd) => cmd.includes('trending youtube'),
        action: () => {
          const topics = getTrendingYouTubeTopics();
          speak('Trending YouTube topics are:');
          topics.forEach((topic) => speak(topic));
        },
      },
      {
        condition: (cmd) => cmd.includes('instagram messages'),
        action: () => speak('Instagram messages feature is not available in the browser.'),
      },
      {
        condition: (cmd) => cmd.includes('create file'),
        action: () => {
          const words = command.split(' ');
          if (words.length < 3) {
            speak('Please specify the file name.');
            return;
          }
          const filename = words[words.length - 1];
          speak(`Creating file ${filename} is not fully implemented yet.`);
        },
      },
      {
        condition: (cmd) => cmd.includes('read file'),
        action: () => {
          const words = command.split(' ');
          if (words.length < 3) {
            speak('Please specify the file name.');
            return;
          }
          const filename = words[words.length - 1];
          speak(`Reading file ${filename} is not fully implemented yet.`);
        },
      },
      {
        condition: (cmd) => cmd.includes('delete file'),
        action: () => {
          const words = command.split(' ');
          if (words.length < 3) {
            speak('Please specify the file name.');
            return;
          }
          const filename = words[words.length - 1];
          speak(`Deleting file ${filename} is not fully implemented yet.`);
        },
      },
      {
        condition: (cmd) => cmd.includes('battery status'),
        action: () => checkBatteryStatus(),
      },
      {
        condition: (cmd) => cmd.includes('take a screenshot'),
        action: () => takeScreenshot(),
      },
      {
        condition: (cmd) => cmd.includes('open chrome'),
        action: () => openApplication('chrome'),
      },
      {
        condition: (cmd) => cmd.includes('search for'),
        action: () => {
          const query = command.replace('search for', '').trim();
          webSearch(query);
        },
      },
      {
        condition: (cmd) => cmd.includes('open youtube'),
        action: () => {
          if (typeof window === 'undefined') return;
          window.open('https://www.youtube.com', '_blank');
          speak('Opening YouTube.');
        },
      },
      {
        condition: (cmd) => cmd.includes("what's your name"),
        action: () => speak('I am Nova, your personal AI assistant.'),
      },
      {
        condition: (cmd) => cmd.includes('greet the panel'),
        action: () =>
          speak(
            'Good Morning Teachers ! Today, technology speaks for itself! I am Nova, your advanced AI voice assistant, designed to revolutionize human computer interaction. Unlike conventional voice assistants, I can also operate offline, ensuring lightning-fast execution and enhanced privacy. I can manage files, fetch real-time data, automate tasks, interact with IoT devices, control your system. With my AI-driven capabilities, I am designed to be your ultimate personal assistant – smarter, faster, and more powerful than ever!'
          ),
      },
      {
        condition: (cmd) => cmd.includes('introduce yourself'),
        action: () =>
          speak(
            'I am Nova, your advanced AI voice assistant, designed to revolutionize human computer interaction. Unlike conventional voice assistants, I can also operate offline, ensuring lightning-fast execution and enhanced privacy. I can manage files, fetch real-time data, automate tasks, interact with IoT devices, control your system. With my AI-driven capabilities, I am designed to be your ultimate personal assistant – smarter, faster, and more powerful than ever!'
          ),
      },
      {
        condition: (cmd) => cmd.includes('who are you'),
        action: () =>
          speak(
            'I am Nova, your next-generation AI-powered voice assistant! I operate blazingly fast and offline, ensuring instant execution of your commands without relying on the internet. I can control your system, manage files, fetch real-time data, automate tasks, and even interact with IoT devices. I am designed to be your ultimate personal assistant – smarter, faster, and more powerful than ever!'
          ),
      },
      {
        condition: (cmd) => cmd.includes('tell me a joke'),
        action: () => speak('Why do programmers prefer dark mode? Because light attracts bugs!'),
      },
      {
        condition: (cmd) => cmd.includes('who created you'),
        action: () => speak('I was created by a team of btech students , Mohammad Shaizan , Mohammad Ali Raza khan and Mohamad Raziuddin'),
      },
    ];

    const matchedCommand = commands.find((cmd) => cmd.condition(command));
    if (matchedCommand) {
      await matchedCommand.action();
      return;
    }

    speak("I'm not sure how to help with that yet. Try asking something else!");
  };

  const getTrendingYouTubeTopics = () => ['Trending Video 1', 'Trending Video 2', 'Trending Video 3'];

  const checkBatteryStatus = () => {
    if (typeof window === 'undefined' || !navigator.getBattery) {
      speak('Battery status is not available in this browser.');
      return;
    }
    navigator.getBattery().then((battery) => {
      speak(`Your battery is at ${Math.round(battery.level * 100)}%`);
    });
  };

  const takeScreenshot = () => {
    speak('Taking a screenshot is not supported in the browser yet.');
  };

  const openApplication = (appName) => {
    if (typeof window === 'undefined') return;
    if (appName === 'chrome') {
      window.open('https://www.google.com/chrome/', '_blank');
      speak('Opening Chrome in a new tab.');
    } else {
      speak(`Opening ${appName} is not supported.`);
    }
  };

  const webSearch = (query) => {
    if (typeof window === 'undefined') return;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
    speak(`Searching the web for ${query}.`);
  };

  useEffect(() => {
    if (isClient) {
      speak(' Hello Sir, Good morning, click anywhere to start.');
    }
  }, [isClient]);


  useEffect(() => {
    if (isListening) {
      setShowOverlay(false);
    }
  }, [isListening]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        background: '#0A0A0A',
        cursor: 'pointer',
      }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
    >
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        gl={{ antialias: true, pixelRatio, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={1.5} />
        <pointLight position={[10, 10, 10]} intensity={2} />
        <Scene animationState={animationState} />
        <EffectComposer>
          <Bloom intensity={3} radius={0.2} luminanceThreshold={0.01} luminanceSmoothing={0.4} mipmapBlur={true} />
        </EffectComposer>
      </Canvas>

      <NovaLogo />
      <TimeDisplay />
      <WeatherDisplay />
      <NewsHeadlines />
      <SystemStatus />
      

      <div
        style={{
          position: 'absolute',
          bottom: '60px',
          left: '20px',
          padding: '6px',
          borderRadius: '10px',
          backgroundColor: 'rgba(0,0,0,0.7)',
          border: '2px solid #C71585',
          textAlign: 'center',
          zIndex: 10,
          minWidth: '180px',
          fontFamily: '"Orbitron", sans-serif',
          color: '#FF69B4',
        }}
      >
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Status</div>
        <div style={{ fontSize: '1rem', color: status === 'Listening' ? '#00FF00' : status === 'Speaking' ? '#00FFFF' : '#FFFFFF' }}>
          {status}
        </div>
      </div>
      
      <SubtitleDisplay
      isVisible={isShowingResponse}
      userTranscript={userTranscript}
      novaWords={displayedNovaWords}
    />

      
{/* Interaction prompt */}
{showInteractionPrompt && !isListening && !isSpeaking && (
      <div
        style={{
          position: 'absolute',
          bottom: '60px',
          left: '51%',
          transform: 'translateX(-50%)',
          padding: '10px 20px',
          borderRadius: '10px',
          backgroundColor: 'rgba(0,0,0,0.6)',
          border: '2px solid #00FFAA',
          color: '#00FFAA',
          fontFamily: '"Orbitron", sans-serif',
          animation: 'glow 2s infinite alternate',
        }}
      >
        Click anywhere to interact
      </div>
    )}
  </div>
);


Scene.propTypes = {
  animationState: PropTypes.string.isRequired,
};

const MemoizedScene = memo(Scene);
}

export default VoiceBotWithAnimations;

