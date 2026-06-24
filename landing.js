/* =========================================================
   PREMIUM LANDING PAGE JS - ANSON PARAKKUU
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    
    // 1. PRELOADER LOGIC
    const preloader = document.getElementById('preloader');
    const progressBar = document.querySelector('.loading-progress');
    
    // Simulate loading progress
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress > 100) progress = 100;
        progressBar.style.width = `${progress}%`;
        
        if (progress === 100) {
            clearInterval(interval);
            setTimeout(() => {
                preloader.style.transform = 'translateY(-100%)';
                preloader.style.opacity = '0';
                setTimeout(() => preloader.remove(), 800);
            }, 400);
        }
    }, 200);

    // 2. SCROLL ANIMATION SYSTEM (IntersectionObserver)
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                scrollObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.fade-up').forEach(el => {
        scrollObserver.observe(el);
    });

    // 3. SOUND INTERACTION SYSTEM
    let soundEnabled = false; // Default off, especially on mobile
    const soundToggleBtn = document.getElementById('sound-toggle');
    const iconSoundOn = document.getElementById('icon-sound-on');
    const iconSoundOff = document.getElementById('icon-sound-off');
    
    const uiHoverSound = document.getElementById('ui-hover');
    const uiClickSound = document.getElementById('ui-click');

    // Make sure sounds aren't too loud
    if (uiHoverSound) uiHoverSound.volume = 0.2;
    if (uiClickSound) uiClickSound.volume = 0.4;

    function toggleSound() {
        soundEnabled = !soundEnabled;
        if (soundEnabled) {
            iconSoundOff.style.display = 'none';
            iconSoundOn.style.display = 'block';
            // Play a test sound to confirm
            playClickSound();
        } else {
            iconSoundOn.style.display = 'none';
            iconSoundOff.style.display = 'block';
        }
    }

    // Sound toggle disabled per user request
    // soundToggleBtn.addEventListener('click', toggleSound);

    function playHoverSound() {
        if (!soundEnabled || !uiHoverSound) return;
        const clone = uiHoverSound.cloneNode();
        clone.volume = 0.2;
        clone.play().catch(e => console.log('Hover sound prevented'));
    }

    function playClickSound() {
        if (!soundEnabled || !uiClickSound) return;
        const clone = uiClickSound.cloneNode();
        clone.volume = 0.4;
        clone.play().catch(e => console.log('Click sound prevented'));
    }

    // Attach hover sounds to interactive elements
    document.querySelectorAll('.hover-sound').forEach(el => {
        el.addEventListener('mouseenter', playHoverSound);
        // For mobile tap
        el.addEventListener('touchstart', playHoverSound, { passive: true });
    });

    // Character tap interaction (Mobile + PC)
    document.querySelectorAll('.hover-interaction').forEach(el => {
        el.addEventListener('click', playClickSound);
    });

    // 4. DESKTOP PARALLAX SYSTEM
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) {
        const orbs = document.querySelectorAll('.bg-orb');
        document.addEventListener('mousemove', (e) => {
            const x = e.clientX / window.innerWidth - 0.5;
            const y = e.clientY / window.innerHeight - 0.5;

            orbs.forEach((orb, index) => {
                const speed = (index + 1) * 30; // Different speed for each orb
                orb.style.setProperty('--tx', `${x * speed}px`);
                orb.style.setProperty('--ty', `${y * speed}px`);
            });
        });
    }

    // 5. PAGE TRANSITION (Intercept 'Play Now' clicks)
    // Add page transition div to body
    const transitionDiv = document.createElement('div');
    transitionDiv.className = 'page-transition';
    document.body.appendChild(transitionDiv);

    document.querySelectorAll('.play-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent instant redirect
            const target = btn.getAttribute('href');
            
            playClickSound();
            
            // Fade screen to black
            transitionDiv.classList.add('active');
            
            setTimeout(() => {
                window.location.href = target;
            }, 500); // Wait 500ms for fade
        });
    });

    // 6. SEAMLESS VIDEO LOOP SYSTEM
    const loopVideos = document.querySelectorAll('#video-loop-container .preview-video');
    if (loopVideos.length === 2) {
        let currentVideoIdx = 0;
        
        // Start the first video
        loopVideos[0].play().catch(e => console.log('Auto-play prevented for video'));

        const checkLoop = () => {
            const activeVid = loopVideos[currentVideoIdx];
            const nextVideoIdx = currentVideoIdx === 0 ? 1 : 0;
            
            // If the video has loaded duration and is within 0.5s of the end
            if (activeVid.duration && (activeVid.duration - activeVid.currentTime <= 0.5)) {
                const nextVid = loopVideos[nextVideoIdx];
                nextVid.currentTime = 0;
                nextVid.play().catch(() => {});
                
                nextVid.classList.add('active');
                activeVid.classList.remove('active');
                
                currentVideoIdx = nextVideoIdx;
            }
            
            requestAnimationFrame(checkLoop);
        };
        
        requestAnimationFrame(checkLoop);
    }
});
