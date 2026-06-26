/* =========================================================
   PREMIUM LANDING PAGE JS - ANSON PARAKKUU
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    
    // 1. CINEMATIC PRELOADER LOGIC
    const preloader = document.getElementById('preloader');
    const progressBar = document.querySelector('.loading-progress');
    const percentage = document.querySelector('.loading-percentage');
    
    // Simulate cinematic loading progress
    let progress = 0;
    const interval = setInterval(() => {
        // Random bursts of speed for realism
        progress += Math.floor(Math.random() * 12) + 2;
        if (progress > 100) progress = 100;
        
        if (progressBar) progressBar.style.width = `${progress}%`;
        if (percentage) percentage.textContent = `${progress}%`;
        
        if (progress === 100) {
            clearInterval(interval);
            setTimeout(() => {
                preloader.classList.add('fade-out');
                setTimeout(() => preloader.remove(), 800);
            }, 500);
        }
    }, 120);

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

    // 3. SOUND INTERACTION SYSTEM (Removed as per user request)

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

    // 7. INFINITE AUTO-SCROLL CAROUSEL (Mobile only)
    if (isMobile) {
        const charGrid = document.querySelector('.character-grid');
        if (charGrid) {
            // Clone cards to allow infinite scrolling
            const cards = Array.from(charGrid.children);
            cards.forEach(card => {
                const clone = card.cloneNode(true);
                // Remove ID if exists to prevent duplicates (not strictly needed here but good practice)
                charGrid.appendChild(clone);
            });

            let scrollPos = 0;
            let speed = 1; // Pixels per frame
            let isHovered = false;

            // Pause on touch
            charGrid.addEventListener('touchstart', () => isHovered = true, { passive: true });
            charGrid.addEventListener('touchend', () => {
                isHovered = false;
                // Sync position in case user swiped
                scrollPos = charGrid.scrollLeft;
            });

            function scrollMarquee() {
                if (!isHovered) {
                    scrollPos += speed;
                    charGrid.scrollLeft = scrollPos;
                    
                    // Reset if we've scrolled past the first half
                    // Because we duplicated the content exactly once, scrollWidth / 2 is the exact midpoint
                    if (scrollPos >= (charGrid.scrollWidth / 2)) {
                        scrollPos = 0;
                        charGrid.scrollLeft = 0;
                    }
                }
                requestAnimationFrame(scrollMarquee);
            }
            
            // Start the marquee
            requestAnimationFrame(scrollMarquee);
        }
    }
});
