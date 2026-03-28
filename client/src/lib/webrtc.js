import Peer from 'simple-peer';
import { socket, useGameStore } from '../store/gameStore.js';

class WebRTCManager {
    constructor() {
        this.peers = {}; // socketId -> Peer instance
        this.stream = null;
        this.audioElements = {};
        this.isMuted = false;
        
        // Listeners for signaling
        socket.on('webrtc_offer', this.handleOffer.bind(this));
        socket.on('webrtc_answer', this.handleAnswer.bind(this));
        socket.on('webrtc_ice_candidate', this.handleIceCandidate.bind(this));
    }

    async init() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
            return true;
        } catch (err) {
            console.error("Mic access denied", err);
            return false;
        }
    }

    toggleMute() {
        if(this.stream) {
            this.isMuted = !this.isMuted;
            this.stream.getAudioTracks().forEach(track => track.enabled = !this.isMuted);
        }
        return this.isMuted;
    }

    connectToPeer(targetUsername, targetSocketId) {
        if (!this.stream) return;
        if (this.peers[targetSocketId]) return;

        const peer = new Peer({
            initiator: true,
            trickle: true,
            stream: this.stream
        });

        this.setupPeerEvents(peer, targetUsername, targetSocketId);
        this.peers[targetSocketId] = peer;
    }

    handleOffer({ sender, offer, target }) {
        if (!this.stream) return;
        
        const peer = new Peer({
            initiator: false,
            trickle: true,
            stream: this.stream
        });

        this.setupPeerEvents(peer, "Remote", sender);
        peer.signal(offer);
        this.peers[sender] = peer;
    }

    handleAnswer({ sender, answer }) {
        if (this.peers[sender]) {
            this.peers[sender].signal(answer);
        }
    }

    handleIceCandidate({ sender, candidate }) {
        if (this.peers[sender]) {
            this.peers[sender].signal(candidate);
        }
    }

    setupPeerEvents(peer, targetUsername, targetSocketId) {
        peer.on('signal', data => {
            if (data.type === 'offer') {
                socket.emit('webrtc_offer', { target: targetUsername, offer: data });
            } else if (data.type === 'answer') {
                socket.emit('webrtc_answer', { target: targetUsername, answer: data });
            } else if (data.candidate) {
                socket.emit('webrtc_ice_candidate', { target: targetUsername, candidate: data });
            }
        });

        peer.on('stream', stream => {
            const audio = new Audio();
            audio.srcObject = stream;
            audio.play().catch(e => console.error("Audio play error", e));
            this.audioElements[targetSocketId] = audio;
        });

        peer.on('close', () => {
            if(this.audioElements[targetSocketId]) {
                this.audioElements[targetSocketId].pause();
                delete this.audioElements[targetSocketId];
            }
            delete this.peers[targetSocketId];
        });
    }
    
    disconnectAll() {
        Object.values(this.peers).forEach(p => p.destroy());
        this.peers = {};
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
    }
}

export const rtcManager = new WebRTCManager();
