import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, AlertTriangle, CheckCircle, MapPin, Clock, User, Phone, TrendingUp, TrendingDown } from 'lucide-react';

const DrinkSafetyMonitor = () => {
  // User profile with historical baseline
  const [userProfile] = useState({
    name: "Alex Johnson",
    avgRestingHR: 68,
    avgActiveHR: 95,
    weeklyAvgHR: 72,
    monthlyAvgHR: 71,
    emergencyContact: "+1 (555) 123-4567",
    emergencyName: "Sarah Johnson",
    emergencyEmail: "raquelmartin0320@gmail.com"
  });

  const [isMonitoring, setIsMonitoring] = useState(false);
  const [heartRateData, setHeartRateData] = useState([]);
  const [currentHeartRate, setCurrentHeartRate] = useState(userProfile.weeklyAvgHR);
  const [gasLevel, setGasLevel] = useState(0);
  const [alerts, setAlerts] = useState([]);
  const [drinkSpiked, setDrinkSpiked] = useState(false);
  const [spikeTime, setSpikeTime] = useState(null);
  const [rescanAttempted, setRescanAttempted] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [emergencyNotificationSent, setEmergencyNotificationSent] = useState(false);
  const [lastAlertTime, setLastAlertTime] = useState(0);
  const [lastAlertLocation, setLastAlertLocation] = useState(null);
  
  // Manual control states
  const [manualHRIncrease, setManualHRIncrease] = useState(false);
  const [manualGasIncrease, setManualGasIncrease] = useState(false);
  const [hrIncreaseStartTime, setHrIncreaseStartTime] = useState(null);
  const [gasIncreaseStartTime, setGasIncreaseStartTime] = useState(null);
  
  const timeRef = useRef(0);
  const intervalRef = useRef(null);

  const getLocation = () => {
    const locations = [
      "Clifton Rd NE",
      "Downtown Club, 456 Park Ave",
      "Restaurant Row, 789 Oak Blvd"
    ];
    return locations[Math.floor(Math.random() * locations.length)];
  };

  const generateHeartRate = (time, baseline) => {
    let hr = baseline;
    
    // Normal variation
    hr += Math.sin(time / 10) * 3;
    hr += Math.random() * 4 - 2;
    
    // Manual increase control - gradual rise
    if (manualHRIncrease && hrIncreaseStartTime !== null) {
      const timeElapsed = time - hrIncreaseStartTime;
      const maxIncrease = 40;
      // Gradual increase over 20 seconds, then plateau
      const increaseAmount = Math.min((timeElapsed / 20) * maxIncrease, maxIncrease);
      hr += increaseAmount;
      hr += Math.random() * 8 - 4; // More irregularity when elevated
    }
    
    return Math.max(50, Math.min(160, Math.round(hr)));
  };

  // Simulate gas sensor - realistic ppm levels (0-5 ppm max, threshold 0.1 ppm)
  const detectGas = (shouldIncrease, startTime, currentTime) => {
    if (!shouldIncrease || startTime === null) {
      // Background noise: very low random values 0-0.01 ppm
      return Math.random() * 0.01;
    }
    
    const timeElapsed = currentTime - startTime;
    
    // Initial scan has 40% chance of missing detection (only in first 2 seconds)
    if (timeElapsed < 2 && !rescanAttempted && Math.random() < 0.4) {
      return Math.random() * 0.08; // Below 0.1 threshold on first scan
    }
    
    // After initial period, gradually increase to dangerous levels
    // Range: 0.1 - 5.0 ppm (well above 0.1 threshold, max 5 ppm)
    const baseGasLevel = 0.5; // Starting point above threshold
    const maxGasLevel = 5.0; // Maximum dangerous level
    
    // Gradual increase over time, capped at 5 ppm
    const timeBasedIncrease = Math.min(timeElapsed * 0.1, maxGasLevel - baseGasLevel);
    const variation = Math.random() * 1.5; // Random variation
    
    return Math.min(baseGasLevel + timeBasedIncrease + variation, maxGasLevel);
  };

  const addAlert = (type, message, data = {}) => {
    const location = getLocation();
    const newAlert = {
      id: Date.now(),
      type,
      message,
      timestamp: new Date().toLocaleTimeString(),
      location: location,
      ...data
    };
    setAlerts(prev => [newAlert, ...prev].slice(0, 30));
    setAlertCount(prev => prev + 1);
    setLastAlertTime(timeRef.current);
    setLastAlertLocation(location); // Store the location when alert happens
  };

  const sendEmergencyNotification = async () => {
    if (!emergencyNotificationSent) {
      setEmergencyNotificationSent(true);
      
      // Prepare data for webhook
      const emergencyData = {
        dependent: {
          name: userProfile.name,
          lastKnownLocation: lastAlertLocation || getLocation(),
          currentHeartRate: currentHeartRate,
          weeklyBaselineHR: userProfile.weeklyAvgHR,
          monthlyBaselineHR: userProfile.monthlyAvgHR
        },
        emergency: {
          alertCount: alertCount,
          gasLevelDetected: gasLevel.toFixed(3),
          timestamp: new Date().toISOString(),
          timeOfDay: new Date().toLocaleTimeString()
        },
        contact: {
          name: userProfile.emergencyName,
          phone: userProfile.emergencyContact,
          email: userProfile.emergencyEmail
        },
        "health data": JSON.stringify(heartRateData.map(d => ({
          time: d.time,
          heartRate: d.hr,
          gasLevel: d.gas
        }))),
        emailBody: {
          subject: `🚨 URGENT: Health Alert for ${userProfile.name}`,
          greeting: `Dear ${userProfile.emergencyName},`,
          mainMessage: `We are reaching out to inform you of a critical health alert regarding ${userProfile.name}. Our monitoring system has detected significant changes in their heart rate patterns over an extended period, raising concerns about their wellbeing.`,
          details: [
            `📍 Last Known Location: ${lastAlertLocation || getLocation()}`,
            `⏰ Time of Alert: ${new Date().toLocaleString()}`,
            `💓 Current Heart Rate: ${currentHeartRate} BPM (Baseline: ${userProfile.weeklyAvgHR} BPM)`,
            `🔬 Gas Level Reading: ${gasLevel.toFixed(3)} ppm ${gasLevel > 0.1 ? '⚠️ ELEVATED' : '✓ Normal'}`,
            `📊 Total Alerts Triggered: ${alertCount}`,
            `⚡ Heart Rate Deviation: ${Math.abs(currentHeartRate - userProfile.weeklyAvgHR).toFixed(0)} BPM from normal`
          ],
          urgentNote: gasLevel > 0.1
            ? `⚠️ CRITICAL: Our sensors have detected elevated chemical levels (${gasLevel.toFixed(3)} ppm) in their environment, suggesting potential drink tampering or substance exposure. Immediate action is strongly recommended.`
            : `Their heart rate has shown unusual patterns that deviate significantly from their established baseline. While no harmful substances were detected, this warrants immediate attention.`,
          callToAction: `Please try to reach ${userProfile.name} immediately at their last known location. If you cannot reach them within the next few minutes, we strongly recommend contacting local emergency services.`,
          attachments: `This email includes detailed heart rate and gas level data from the monitoring session for medical reference.`,
          closing: `This is an automated alert from the Predictive Risk Interception System. Time is critical - please act promptly!!.`,
        }
      };
      
      // Log the data that would be sent to webhook
      console.log('Emergency Webhook Data:', JSON.stringify(emergencyData, null, 2));
      
      // Direct n8n webhook URL
      //const webhookURL = 'https://dubemmmm.app.n8n.cloud/webhook/24e4c41f-79d9-478d-93c5-82990a4fdbb2';
      const webhookURL = 'http://localhost:5678/webhook/06b1aa8e-de73-437b-b511-a8039bab3cc5';
      try {
        // Uncomment this when you have your webhook URL ready
        
        const response = await fetch(webhookURL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emergencyData)
        });
        
        if (response.ok) {
          console.log('Emergency notification sent successfully');
        }
        
        
        // For now, just show the notification in the UI
        addAlert('emergency', `EMERGENCY: Notification sent to ${userProfile.emergencyName}`, {
          contactNumber: userProfile.emergencyContact,
          alertsSent: alertCount,
          location: lastAlertLocation,
          note: 'Emergency email dispatched with full health data and location details'
        });
      } catch (error) {
        console.error('Failed to send emergency notification:', error);
      }
    }
  };

  useEffect(() => {
    if (isMonitoring) {
      intervalRef.current = setInterval(() => {
        timeRef.current += 1;
        
        // Generate heart rate based on user's baseline
        const hr = generateHeartRate(timeRef.current, userProfile.weeklyAvgHR);
        setCurrentHeartRate(hr);
        
        // Update gas level
        const gasReading = detectGas(manualGasIncrease, gasIncreaseStartTime, timeRef.current);
        setGasLevel(gasReading);
        
        // Check for anomalies - every 10 seconds
        if (timeRef.current - lastAlertTime >= 10) {
          const weeklyDeviation = Math.abs(hr - userProfile.weeklyAvgHR);
          const monthlyDeviation = Math.abs(hr - userProfile.monthlyAvgHR);
          const currentGas = gasReading;
          
          // Scenario 1: Gas detected (standalone) - immediate alert
          if (currentGas > 0.1 && timeRef.current > 10) {
            const gasLevelCategory = currentGas > 2.0 ? 'critically dangerous' : currentGas > 1.0 ? 'highly dangerous' : 'potentially dangerous';
            addAlert('danger', 'CRITICAL: Harmful substance detected in drink!', {
              gasLevel: `${currentGas.toFixed(3)} ppm`,
              heartRate: hr,
              weeklyBaseline: userProfile.weeklyAvgHR,
              note: `Gas levels (${currentGas.toFixed(3)} ppm) are ${gasLevelCategory} - immediate action required. Your drink may have been tampered with.`
            });
          }
          // Scenario 2: HR significantly abnormal - check gas levels
          else if (weeklyDeviation > 20 && timeRef.current > 10) {
            // Rescan if heart rate is high but gas wasn't detected initially
            if (manualGasIncrease && !rescanAttempted && currentGas < 0.1) {
              setRescanAttempted(true);
              const rescanGas = detectGas(true, gasIncreaseStartTime, timeRef.current);
              setGasLevel(rescanGas);
              
              if (rescanGas > 0.1) {
                addAlert('danger', 'CRITICAL: Drink tampering confirmed on rescan!', {
                  gasLevel: `${rescanGas.toFixed(3)} ppm`,
                  heartRate: hr,
                  weeklyBaseline: userProfile.weeklyAvgHR,
                  deviation: weeklyDeviation.toFixed(0),
                  note: `Initial scan missed contamination. High-sensitivity rescan detected ${rescanGas.toFixed(3)} ppm after heart rate spike. Seek help immediately.`
                });
              } else {
                // HR high but still no gas after rescan
                const direction = hr > userProfile.weeklyAvgHR ? 'elevated' : 'decreased';
                const concern = hr > userProfile.weeklyAvgHR ? 'stress, physical activity, or anxiety' : 'fatigue or sudden relaxation';
                addAlert('warning', `Heart rate ${direction} significantly`, {
                  heartRate: hr,
                  weeklyBaseline: userProfile.weeklyAvgHR,
                  monthlyBaseline: userProfile.monthlyAvgHR,
                  weeklyDeviation: weeklyDeviation.toFixed(0),
                  monthlyDeviation: monthlyDeviation.toFixed(0),
                  note: `Your heart rate is ${weeklyDeviation.toFixed(0)} BPM ${direction} from your normal baseline. No harmful substances detected - this may be due to ${concern}. Stay alert.`
                });
              }
            } else if (currentGas > 0.1) {
              // Scenario 3: Both gas detected AND heart rate abnormal
              addAlert('danger', 'CRITICAL: Substance exposure with physiological response!', {
                gasLevel: `${currentGas.toFixed(3)} ppm`,
                heartRate: hr,
                weeklyBaseline: userProfile.weeklyAvgHR,
                deviation: weeklyDeviation.toFixed(0),
                note: `Dangerous combination: ${currentGas.toFixed(3)} ppm gas detected AND heart rate ${weeklyDeviation.toFixed(0)} BPM abnormal. Your body is reacting to the substance. Leave immediately and seek medical help.`
              });
            } else {
              // Scenario 4: Heart rate abnormal but no substance detected
              const direction = hr > userProfile.weeklyAvgHR ? 'elevated' : 'decreased';
              const concern = hr > userProfile.weeklyAvgHR ? 'stress, excitement, or physical activity' : 'sudden fatigue or medication effects';
              addAlert('warning', `Heart rate ${direction} significantly`, {
                heartRate: hr,
                weeklyBaseline: userProfile.weeklyAvgHR,
                monthlyBaseline: userProfile.monthlyAvgHR,
                weeklyDeviation: weeklyDeviation.toFixed(0),
                monthlyDeviation: monthlyDeviation.toFixed(0),
                note: `Your heart rate is ${weeklyDeviation.toFixed(0)} BPM ${direction} from your normal baseline. No harmful substances detected - this may be due to ${concern}. Monitor yourself closely.`
              });
            }
          }
        }
        
        // Check if 2 or more alerts reached
        if (alertCount >= 2 && !emergencyNotificationSent) {
          sendEmergencyNotification();
        }
        
        // Update chart data
        setHeartRateData(prev => {
          const newData = [...prev, {
            time: timeRef.current,
            hr: hr,
            weeklyBaseline: userProfile.weeklyAvgHR,
            monthlyBaseline: userProfile.monthlyAvgHR,
            gas: gasLevel
          }];
          return newData.slice(-120);
        });
        
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isMonitoring, currentHeartRate, gasLevel, manualHRIncrease, manualGasIncrease, rescanAttempted, alertCount, lastAlertTime, emergencyNotificationSent, hrIncreaseStartTime, gasIncreaseStartTime]);

  const resetSimulation = () => {
    setIsMonitoring(false);
    setHeartRateData([]);
    setCurrentHeartRate(userProfile.weeklyAvgHR);
    setGasLevel(0);
    setAlerts([]);
    setDrinkSpiked(false);
    setSpikeTime(null);
    setRescanAttempted(false);
    setManualHRIncrease(false);
    setManualGasIncrease(false);
    setAlertCount(0);
    setEmergencyNotificationSent(false);
    setLastAlertTime(0);
    setLastAlertLocation(null);
    setHrIncreaseStartTime(null);
    setGasIncreaseStartTime(null);
    timeRef.current = 0;
  };

  const toggleHeartRate = () => {
    const newState = !manualHRIncrease;
    setManualHRIncrease(newState);
    if (newState) {
      setHrIncreaseStartTime(timeRef.current);
      setRescanAttempted(false);
    } else {
      setHrIncreaseStartTime(null);
    }
  };

  const toggleGasLevel = () => {
    const newState = !manualGasIncrease;
    setManualGasIncrease(newState);
    if (newState) {
      setDrinkSpiked(true);
      setSpikeTime(timeRef.current);
      setGasIncreaseStartTime(timeRef.current);
      setRescanAttempted(false);
    } else {
      setDrinkSpiked(false);
      setGasIncreaseStartTime(null);
    }
  };

  const getAlertColor = (type) => {
    switch(type) {
      case 'danger': return 'bg-red-100 border-red-500 text-red-900';
      case 'emergency': return 'bg-red-200 border-red-700 text-red-950';
      case 'warning': return 'bg-yellow-100 border-yellow-500 text-yellow-900';
      default: return 'bg-blue-100 border-blue-500 text-blue-900';
    }
  };

  const getAlertIcon = (type) => {
    switch(type) {
      case 'danger': return <AlertTriangle className="text-red-600" />;
      case 'emergency': return <Phone className="text-red-700" />;
      case 'warning': return <Activity className="text-yellow-600" />;
      default: return <CheckCircle className="text-blue-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
            <h1 className="text-3xl font-bold mb-2">Drink Safety Monitor</h1>
            <p className="text-purple-100">Real-time detection with personalized baseline monitoring</p>
          </div>

          {/* User Profile */}
          <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 border-b">
            <div className="flex items-center gap-4">
              <div className="bg-white p-3 rounded-full">
                <User className="text-indigo-600" size={32} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-800">{userProfile.name}</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                  <div>
                    <span className="text-gray-600">Resting HR:</span>
                    <span className="font-bold text-gray-800 ml-2">{userProfile.avgRestingHR} BPM</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Active HR:</span>
                    <span className="font-bold text-gray-800 ml-2">{userProfile.avgActiveHR} BPM</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Weekly Avg:</span>
                    <span className="font-bold text-indigo-600 ml-2">{userProfile.weeklyAvgHR} BPM</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Monthly Avg:</span>
                    <span className="font-bold text-indigo-600 ml-2">{userProfile.monthlyAvgHR} BPM</span>
                  </div>
                </div>
                <div className="mt-2 text-sm">
                  <span className="text-gray-600">Emergency Contact:</span>
                  <span className="font-bold text-gray-800 ml-2">{userProfile.emergencyName} - {userProfile.emergencyContact}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="p-6 bg-gray-50 border-b">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h3 className="font-bold text-gray-700">System Controls</h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsMonitoring(!isMonitoring)}
                    className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                      isMonitoring 
                        ? 'bg-red-500 hover:bg-red-600 text-white' 
                        : 'bg-green-500 hover:bg-green-600 text-white'
                    }`}
                  >
                    {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
                  </button>
                  <button
                    onClick={resetSimulation}
                    className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition-all"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-gray-700">Manual Triggers</h3>
                <div className="flex gap-3">
                  <button
                    onClick={toggleHeartRate}
                    disabled={!isMonitoring}
                    className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                      manualHRIncrease 
                        ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                        : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed'
                    }`}
                  >
                    <TrendingUp size={20} />
                    {manualHRIncrease ? 'Stop HR Rise' : 'Increase HR'}
                  </button>
                  <button
                    onClick={toggleGasLevel}
                    disabled={!isMonitoring}
                    className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                      manualGasIncrease 
                        ? 'bg-red-500 hover:bg-red-600 text-white' 
                        : 'bg-purple-500 hover:bg-purple-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed'
                    }`}
                  >
                    <TrendingUp size={20} />
                    {manualGasIncrease ? 'Stop Gas Rise' : 'Increase Gas'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                isMonitoring ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
              }`}>
                <div className={`w-3 h-3 rounded-full ${isMonitoring ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                <span className="font-semibold">{isMonitoring ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  <span className="text-gray-600">Alert Count:</span>
                  <span className={`font-bold ml-2 ${alertCount >= 2 ? 'text-red-600' : 'text-gray-800'}`}>
                    {alertCount} / 2
                  </span>
                </div>
                {emergencyNotificationSent && (
                  <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                    <Phone size={16} />
                    Emergency Contacted
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Vital Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
            <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-lg border-2 border-red-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-red-600 font-semibold">Heart Rate</span>
                <Activity className="text-red-500" />
              </div>
              <div className="text-4xl font-bold text-red-700">{currentHeartRate}</div>
              <div className="text-sm text-red-600 mt-1">BPM</div>
              <div className="text-xs text-red-500 mt-2">
                Your baseline: {userProfile.weeklyAvgHR} BPM
              </div>
              <div className="text-xs text-red-400 mt-1">
                Deviation: {Math.abs(currentHeartRate - userProfile.weeklyAvgHR).toFixed(0)} BPM
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg border-2 border-purple-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-purple-600 font-semibold">Gas Level</span>
                <AlertTriangle className="text-purple-500" />
              </div>
              <div className="text-4xl font-bold text-purple-700">{gasLevel.toFixed(3)}</div>
              <div className="text-sm text-purple-600 mt-1">ppm</div>
              <div className="text-xs text-purple-500 mt-2">Threshold: 0.1 ppm</div>
              {rescanAttempted && (
                <div className="text-xs text-purple-600 mt-1 font-semibold">Rescan performed</div>
              )}
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border-2 border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-600 font-semibold">Status</span>
                <CheckCircle className="text-blue-500" />
              </div>
              <div className={`text-2xl font-bold mt-2 ${
                gasLevel > 0.1 ? 'text-red-600' : 'text-green-600'
              }`}>
                {gasLevel > 0.1 ? 'ALERT' : 'Normal'}
              </div>
              <div className="text-xs text-blue-500 mt-2">
                {isMonitoring ? 'Continuous monitoring' : 'System idle'}
              </div>
              <div className="text-xs text-blue-400 mt-1">
                Alerts every 10 seconds when needed
              </div>
            </div>
          </div>

          {/* Heart Rate Chart */}
          <div className="p-6 bg-white">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Heart Rate Monitoring</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={heartRateData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  label={{ value: 'Time (seconds)', position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  label={{ value: 'BPM', angle: -90, position: 'insideLeft' }}
                  domain={[50, 160]}
                />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="hr" 
                  stroke="#ef4444" 
                  name="Heart Rate"
                  strokeWidth={2}
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="weeklyBaseline" 
                  stroke="#3b82f6" 
                  name="Weekly Baseline"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="monthlyBaseline" 
                  stroke="#8b5cf6" 
                  name="Monthly Baseline"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Alerts Panel */}
          <div className="p-6 bg-gray-50">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Alert History</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No alerts yet. Monitoring for anomalies...
                </div>
              ) : (
                alerts.map(alert => (
                  <div 
                    key={alert.id}
                    className={`p-4 rounded-lg border-l-4 ${getAlertColor(alert.type)}`}
                  >
                    <div className="flex items-start gap-3">
                      {getAlertIcon(alert.type)}
                      <div className="flex-1">
                        <div className="font-bold">{alert.message}</div>
                        <div className="text-sm mt-2 space-y-1">
                          <div className="flex items-center gap-2">
                            <Clock size={14} />
                            <span>{alert.timestamp}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin size={14} />
                            <span>{alert.location}</span>
                          </div>
                          {alert.heartRate && (
                            <div>Heart Rate: {alert.heartRate} BPM</div>
                          )}
                          {alert.gasLevel && (
                            <div>Gas Level: {alert.gasLevel}</div>
                          )}
                          {alert.weeklyBaseline && (
                            <div>Weekly Baseline: {alert.weeklyBaseline} BPM</div>
                          )}
                          {alert.weeklyDeviation && (
                            <div>Deviation from Weekly: {alert.weeklyDeviation} BPM</div>
                          )}
                          {alert.monthlyDeviation && (
                            <div>Deviation from Monthly: {alert.monthlyDeviation} BPM</div>
                          )}
                          {alert.contactNumber && (
                            <div className="font-semibold text-red-700">
                              Contact Called: {alert.contactNumber}
                            </div>
                          )}
                          {alert.alertsSent && (
                            <div>Total Alerts: {alert.alertsSent}</div>
                          )}
                          {alert.note && (
                            <div className="italic mt-1 text-xs bg-white bg-opacity-50 p-2 rounded">
                              {alert.note}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Info Panel */}
        <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
          <h3 className="font-bold text-lg mb-3 text-gray-800">How It Works</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p><strong>Personalized Baseline:</strong> Uses your historical weekly and monthly average heart rate as the baseline, not running average</p>
            <p><strong>Manual Controls:</strong> Use the trigger buttons to manually increase heart rate or gas levels to test different scenarios</p>
            <p><strong>Gas Detection:</strong> Monitors for harmful gas levels in parts per million (ppm). Safe range: 0-0.01 ppm. Alert threshold: 0.1 ppm. Maximum dangerous level: 5 ppm</p>
            <p><strong>Smart Detection:</strong> Checks gas levels when heart rate deviates more than 20 BPM from your weekly baseline</p>
            <p><strong>Alert Frequency:</strong> Sends tailored alerts every 10 seconds when anomalies are detected, with context-specific warnings</p>
            <p><strong>Emergency Protocol:</strong> After 2 alerts, automatically contacts your designated emergency contact with location and health data</p>
            <p><strong>Rescan Feature:</strong> If heart rate spikes but gas not detected initially, performs high-sensitivity rescan</p>
            <p><strong>Contextual Alerts:</strong> Alerts provide specific information about detected dangers and suggest possible causes for anomalies</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DrinkSafetyMonitor;
