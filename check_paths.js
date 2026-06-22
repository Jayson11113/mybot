const path = require('path');
const fs = require('fs');

const p1 = path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Edge', 'User Data', 'Default', 'Network', 'Cookies');
const p2 = path.join(process.env.LOCALAPPDATA, 'Microsoft/Edge/User Data/Default/Network/Cookies');

console.log('LOCALAPPDATA:', process.env.LOCALAPPDATA);
console.log('Path 1:', p1);
console.log('Exists 1:', fs.existsSync(p1));
console.log('Path 2:', p2);
console.log('Exists 2:', fs.existsSync(p2));

// Search manually
const base = path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Edge', 'User Data');
if (fs.existsSync(base)) {
    console.log('Base exists:', base);
    const files = fs.readdirSync(base);
    console.log('Files in base:', files.filter(f => f.includes('Default') || f.includes('Profile')));
    
    const defaultPath = path.join(base, 'Default');
    if (fs.existsSync(defaultPath)) {
        console.log('Default exists');
        const networkPath = path.join(defaultPath, 'Network');
        if (fs.existsSync(networkPath)) {
            console.log('Network exists');
            console.log('Files in Network:', fs.readdirSync(networkPath));
        }
    }
} else {
    console.log('Base DOES NOT exist');
}
