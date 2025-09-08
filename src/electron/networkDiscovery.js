const dgram = require('dgram');
const os = require('os');
const fs = require('fs');
const path = require('path');

class NetworkDiscovery {
  constructor() {
    this.BROADCAST_PORT = 8765;
    this.DISCOVERY_PORT = 8766;
    this.SERVICE_IDENTIFIER = 'REVOTEC_INVENTORY_SYSTEM';
    this.configPath = path.join(os.homedir(), '.revotec', 'network.json');
  }

  // Get all local IP addresses
  getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    
    for (let iface in interfaces) {
      for (let addr of interfaces[iface]) {
        if (addr.family === 'IPv4' && !addr.internal) {
          addresses.push(addr.address);
        }
      }
    }
    
    return addresses;
  }

  // Start broadcasting this desktop app's presence
  startBroadcasting(serverPort = 4000) {
    const socket = dgram.createSocket('udp4');
    const ips = this.getLocalIPs();
    
    console.log('┌─────────────────────────────────────────────────────────');
    console.log('│ 📡 STARTING UDP BROADCAST DISCOVERY');
    console.log('├─────────────────────────────────────────────────────────');
    console.log(`│ 🏷️  Service ID: ${this.SERVICE_IDENTIFIER}`);
    console.log(`│ 🔌 Server Port: ${serverPort}`);
    console.log(`│ 📢 Broadcast Port: ${this.BROADCAST_PORT}`);
    console.log(`│ 🖥️  Hostname: ${os.hostname()}`);
    console.log(`│ 🌐 Local IPs: ${ips.join(', ')}`);
    console.log('└─────────────────────────────────────────────────────────');
    
    const message = JSON.stringify({
      service: this.SERVICE_IDENTIFIER,
      type: 'DESKTOP_SERVER',
      port: serverPort,
      ips: ips,
      hostname: os.hostname(),
      timestamp: Date.now()
    });

    socket.bind(() => {
      socket.setBroadcast(true);
      
      // Broadcast every 5 seconds to multiple addresses
      setInterval(() => {
        // Global broadcast
        socket.send(message, 0, message.length, this.BROADCAST_PORT, '255.255.255.255', (err) => {
          if (err) console.error('❌ [UDP] Global broadcast error:', err);
          else console.log('📡 [UDP] Broadcasting desktop presence to global (255.255.255.255:8765)');
        });
        
        // Subnet-specific broadcasts for hotspot compatibility
        const currentIPs = this.getLocalIPs();
        console.log(`📡 [UDP] Desktop IPs: ${currentIPs.join(', ')}`);
        currentIPs.forEach(ip => {
          const parts = ip.split('.');
          const subnet = `${parts[0]}.${parts[1]}.${parts[2]}.255`;
          socket.send(message, 0, message.length, this.BROADCAST_PORT, subnet, (err) => {
            if (err) console.error(`❌ [UDP] Subnet broadcast error to ${subnet}:`, err);
            else console.log(`📡 [UDP] Broadcasting to subnet ${subnet}:8765 (for hotspot: ${ip})`);
          });
        });
      }, 5000);
    });

    console.log('🔊 Desktop server discovery service started');
    return socket;
  }

  // Listen for other services on the network
  startListening(onServiceFound) {
    const socket = dgram.createSocket('udp4');
    
    socket.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        
        if (data.service === this.SERVICE_IDENTIFIER) {
          console.log(`🔍 Found ${data.type} at ${rinfo.address}:${data.port}`);
          
          // Save discovered services to config
          this.saveServiceLocation(data.type, {
            ip: rinfo.address,
            port: data.port,
            hostname: data.hostname,
            lastSeen: Date.now()
          });
          
          if (onServiceFound) {
            onServiceFound(data, rinfo);
          }
        }
      } catch (err) {
        // Ignore invalid messages
      }
    });

    socket.bind(this.DISCOVERY_PORT, () => {
      console.log(`👂 Listening for services on port ${this.DISCOVERY_PORT}`);
    });

    return socket;
  }

  // Save discovered service locations
  saveServiceLocation(serviceType, location) {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Read existing config or create new
      let config = {};
      if (fs.existsSync(this.configPath)) {
        config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      }

      // Update service location
      if (!config.services) config.services = {};
      config.services[serviceType] = location;

      // Save config
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      console.log(`💾 Saved ${serviceType} location: ${location.ip}:${location.port}`);
    } catch (err) {
      console.error('Failed to save service location:', err);
    }
  }

  // Get saved service locations
  getServiceLocations() {
    try {
      if (fs.existsSync(this.configPath)) {
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        return config.services || {};
      }
    } catch (err) {
      console.error('Failed to read service locations:', err);
    }
    return {};
  }

  // Find services by scanning the network
  async scanNetwork(serviceType = 'BACKEND_SERVER', timeout = 5000) {
    return new Promise((resolve) => {
      const foundServices = [];
      const socket = dgram.createSocket('udp4');
      
      // Request announcement from services
      const request = JSON.stringify({
        service: this.SERVICE_IDENTIFIER,
        type: 'DISCOVERY_REQUEST',
        seeking: serviceType
      });

      socket.on('message', (msg, rinfo) => {
        try {
          const data = JSON.parse(msg.toString());
          if (data.service === this.SERVICE_IDENTIFIER && data.type === serviceType) {
            foundServices.push({
              ...data,
              ip: rinfo.address
            });
          }
        } catch (err) {
          // Ignore invalid messages
        }
      });

      socket.bind(() => {
        socket.setBroadcast(true);
        socket.send(request, 0, request.length, this.BROADCAST_PORT, '255.255.255.255');
        
        setTimeout(() => {
          socket.close();
          resolve(foundServices);
        }, timeout);
      });
    });
  }

  // Test connection to a service
  async testConnection(ip, port) {
    try {
      const response = await fetch(`http://${ip}:${port}/health`, {
        method: 'GET',
        timeout: 3000
      });
      return response.ok;
    } catch (err) {
      return false;
    }
  }

  // Get the best available IP for a service
  async getBestServiceIP(serviceType, preferredPort) {
    // First check saved locations
    const saved = this.getServiceLocations();
    if (saved[serviceType]) {
      const isAlive = await this.testConnection(saved[serviceType].ip, saved[serviceType].port);
      if (isAlive) {
        return `${saved[serviceType].ip}:${saved[serviceType].port}`;
      }
    }

    // If saved location doesn't work, scan network
    console.log(`🔍 Scanning network for ${serviceType}...`);
    const services = await this.scanNetwork(serviceType);
    
    for (const service of services) {
      const port = service.port || preferredPort;
      const isAlive = await this.testConnection(service.ip, port);
      if (isAlive) {
        this.saveServiceLocation(serviceType, {
          ip: service.ip,
          port: port,
          hostname: service.hostname || 'unknown',
          lastSeen: Date.now()
        });
        return `${service.ip}:${port}`;
      }
    }

    // Fallback to localhost
    return `localhost:${preferredPort}`;
  }
}

module.exports = NetworkDiscovery;