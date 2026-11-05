/* ==========================================================================
   پنجره روشنایی — اسکریپت اصلی سایت
   فایل: js/script.js
   ========================================================================== */

(function () {
    'use strict';

    /* ---------- 0. ابزارهای کمکی ---------- */
    function $(selector, scope) {
        return (scope || document).querySelector(selector);
    }
    function $$(selector, scope) {
        return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
    }

    /* ==========================================================================
       1. منوی موبایل
       ========================================================================== */
    (function initMobileMenu() {
        var navToggle = $('#navToggle');
        var mainNav = $('#mainNav');
        if (!navToggle || !mainNav) return;

        function closeMenu() {
            navToggle.classList.remove('open');
            mainNav.classList.remove('open');
            navToggle.setAttribute('aria-expanded', 'false');
            navToggle.setAttribute('aria-label', 'باز کردن منو');
        }

        function openMenu() {
            navToggle.classList.add('open');
            mainNav.classList.add('open');
            navToggle.setAttribute('aria-expanded', 'true');
            navToggle.setAttribute('aria-label', 'بستن منو');
        }

        navToggle.addEventListener('click', function () {
            if (mainNav.classList.contains('open')) {
                closeMenu();
            } else {
                openMenu();
            }
        });

        /* بستن منو با کلیک روی لینک‌ها */
        $$('a', mainNav).forEach(function (link) {
            link.addEventListener('click', function () {
                if (window.innerWidth <= 1100) {
                    closeMenu();
                }
            });
        });

        /* بستن منو با کلیک بیرون */
        document.addEventListener('click', function (e) {
            if (window.innerWidth > 1100) return;
            if (!mainNav.classList.contains('open')) return;
            if (mainNav.contains(e.target)) return;
            if (navToggle.contains(e.target)) return;
            closeMenu();
        });

        /* بستن منو با Esc */
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeMenu();
        });

        /* بازنشانی هنگام تغییر اندازه */
        window.addEventListener('resize', function () {
            if (window.innerWidth > 1100) {
                closeMenu();
            }
        });
    })();

    /* ==========================================================================
       2 و 3. اسلایدر اصلی + تغییر خودکار
       ========================================================================== */
    (function initSlider() {
        var slider = $('#heroSlider');
        if (!slider) return;

        var slides = $$('.slide', slider);
        if (!slides.length) return;

        var prevBtn = $('#sliderPrev');
        var nextBtn = $('#sliderNext');
        var dotsWrap = $('#sliderDots');

        var current = 0;
        var total = slides.length;
        var autoDelay = 6000;
        var autoTimer = null;
        var isHovered = false;

        /* ساخت نقاط ناوبری */
        var dots = [];
        if (dotsWrap) {
            dotsWrap.innerHTML = '';
            slides.forEach(function (_, i) {
                var dot = document.createElement('button');
                dot.type = 'button';
                dot.setAttribute('aria-label', 'رفتن به اسلاید ' + (i + 1));
                dot.setAttribute('role', 'tab');
                if (i === 0) dot.classList.add('active');
                dot.addEventListener('click', function () {
                    goTo(i);
                    restartAuto();
                });
                dotsWrap.appendChild(dot);
                dots.push(dot);
            });
        }

        function updateClasses() {
            slides.forEach(function (slide, i) {
                slide.classList.toggle('active', i === current);
            });
            dots.forEach(function (dot, i) {
                dot.classList.toggle('active', i === current);
            });
        }

        function goTo(index) {
            if (index === current) return;
            current = (index + total) % total;
            updateClasses();
        }

        function next() {
            goTo(current + 1);
        }

        function prev() {
            goTo(current - 1);
        }

        function startAuto() {
            stopAuto();
            autoTimer = setInterval(function () {
                if (!isHovered && !document.hidden) {
                    next();
                }
            }, autoDelay);
        }

        function stopAuto() {
            if (autoTimer) {
                clearInterval(autoTimer);
                autoTimer = null;
            }
        }

        function restartAuto() {
            if (autoTimer) startAuto();
        }

        /* دکمه‌ها */
        if (nextBtn) {
            nextBtn.addEventListener('click', function () {
                next();
                restartAuto();
            });
        }
        if (prevBtn) {
            prevBtn.addEventListener('click', function () {
                prev();
                restartAuto();
            });
        }

        /* مکث روی هاور */
        slider.addEventListener('mouseenter', function () { isHovered = true; });
        slider.addEventListener('mouseleave', function () { isHovered = false; });

        /* مکث هنگام مخفی بودن تب */
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                stopAuto();
            } else {
                startAuto();
            }
        });

        /* پشتیبانی از کلیدهای جهت‌دار */
        slider.setAttribute('tabindex', '0');
        slider.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowLeft') {
                next();
                restartAuto();
            } else if (e.key === 'ArrowRight') {
                prev();
                restartAuto();
            }
        });

        /* شروع */
        updateClasses();
        startAuto();
    })();

    /* ==========================================================================
       4. سوالات متداول (FAQ)
       ========================================================================== */
    (function initFaq() {
        var items = $$('.faq-item');
        if (!items.length) return;

        items.forEach(function (item) {
            var btn = $('.faq-question', item);
            var answer = $('.faq-answer', item);
            if (!btn || !answer) return;

            btn.addEventListener('click', function () {
                var isOpen = item.classList.contains('open');

                /* بستن سایر موارد (اکاردئون) */
                items.forEach(function (other) {
                    if (other === item) return;
                    other.classList.remove('open');
                    var otherBtn = $('.faq-question', other);
                    var otherAnswer = $('.faq-answer', other);
                    if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
                    if (otherAnswer) otherAnswer.style.maxHeight = null;
                });

                if (isOpen) {
                    item.classList.remove('open');
                    btn.setAttribute('aria-expanded', 'false');
                    answer.style.maxHeight = null;
                } else {
                    item.classList.add('open');
                    btn.setAttribute('aria-expanded', 'true');
                    answer.style.maxHeight = answer.scrollHeight + 'px';
                }
            });
        });

        /* به‌روزرسانی ارتفاع در تغییر اندازه */
        window.addEventListener('resize', function () {
            items.forEach(function (item) {
                if (!item.classList.contains('open')) return;
                var answer = $('.faq-answer', item);
                if (answer) {
                    answer.style.maxHeight = answer.scrollHeight + 'px';
                }
            });
        });
    })();

    /* ==========================================================================
       5. Lightbox گالری
       ========================================================================== */
    (function initLightbox() {
        var lightbox = $('#lightbox');
        var lightboxImg = $('#lightboxImg');
        var closeBtn = $('#lightboxClose');
        if (!lightbox || !lightboxImg) return;

        var galleryItems = $$('.gallery-item');
        var lastFocused = null;

        function openLightbox(src) {
            if (!src) return;
            lastFocused = document.activeElement;
            lightboxImg.setAttribute('src', src);
            lightbox.classList.add('open');
            lightbox.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
            if (closeBtn) closeBtn.focus();
        }

        function closeLightbox() {
            lightbox.classList.remove('open');
            lightbox.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            /* آزادسازی حافظه پس از انیمیشن */
            setTimeout(function () {
                if (!lightbox.classList.contains('open')) {
                    lightboxImg.setAttribute('src', '');
                }
            }, 300);
            if (lastFocused && typeof lastFocused.focus === 'function') {
                lastFocused.focus();
            }
        }

        galleryItems.forEach(function (item) {
            item.addEventListener('click', function () {
                var src = item.getAttribute('data-img');
                if (!src) {
                    var img = $('img', item);
                    if (img) src = img.getAttribute('src');
                }
                openLightbox(src);
            });
        });

        if (closeBtn) closeBtn.addEventListener('click', closeLightbox);

        /* کلیک روی فضای خالی بستن */
        lightbox.addEventListener('click', function (e) {
            if (e.target === lightbox) closeLightbox();
        });

        /* کلید Esc */
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && lightbox.classList.contains('open')) {
                closeLightbox();
            }
        });
    })();

    /* ==========================================================================
       6 و 7. اعتبارسنجی فرم تماس + پیام موفقیت/خطا
       ========================================================================== */
    (function initContactForm() {
        var form = $('#contactForm');
        if (!form) return;

        var nameEl = $('#name');
        var phoneEl = $('#phone');
        var subjectEl = $('#subject');
        var messageEl = $('#message');
        var msgBox = $('#formMessage');

        /* الگوی شماره تلفن: ارقام فارسی/لاتین، ۱۰ تا ۱۳ رقم، با یا بدون + */
        var phonePattern = /^[+]?[0-9\u06F0-\u06F9]{10,13}$/;
        /* تبدیل ارقام فارسی به لاتین برای اعتبارسنجی */
        function toLatinDigits(str) {
            return String(str)
                .replace(/[\u06F0-\u06F9]/g, function (d) {
                    return String.fromCharCode(d.charCodeAt(0) - 0x06F0 + 48);
                })
                .replace(/[\u0660-\u0669]/g, function (d) {
                    return String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48);
                });
        }

        function setError(field, errorId, show) {
            if (field) field.classList.toggle('error', !!show);
            var err = document.getElementById(errorId);
            if (err) err.classList.toggle('show', !!show);
        }

        function hideAllErrors() {
            setError(nameEl, 'nameError', false);
            setError(phoneEl, 'phoneError', false);
            setError(subjectEl, 'subjectError', false);
            setError(messageEl, 'messageError', false);
        }

        function showFormMessage(type, text) {
            if (!msgBox) return;
            msgBox.className = 'form-message ' + type;
            msgBox.textContent = text;
        }

        function clearFormMessage() {
            if (!msgBox) return;
            msgBox.className = 'form-message';
            msgBox.textContent = '';
        }

        function validate() {
            hideAllErrors();
            var valid = true;

            /* نام */
            if (!nameEl || nameEl.value.trim().length < 3) {
                setError(nameEl, 'nameError', true);
                valid = false;
            }

            /* تلفن */
            var phoneVal = phoneEl ? toLatinDigits(phoneEl.value.trim()) : '';
            if (!phonePattern.test(phoneVal)) {
                setError(phoneEl, 'phoneError', true);
                valid = false;
            }

            /* موضوع */
            if (!subjectEl || !subjectEl.value) {
                setError(subjectEl, 'subjectError', true);
                valid = false;
            }

            /* پیام */
            if (!messageEl || messageEl.value.trim().length < 10) {
                setError(messageEl, 'messageError', true);
                valid = false;
            }

            return valid;
        }

        /* پاکسازی خطا هنگام تایپ */
        [nameEl, phoneEl, subjectEl, messageEl].forEach(function (field, idx) {
            if (!field) return;
            var ids = ['nameError', 'phoneError', 'subjectError', 'messageError'];
            var evt = field.tagName === 'SELECT' ? 'change' : 'input';
            field.addEventListener(evt, function () {
                if (field.classList.contains('error')) {
                    setError(field, ids[idx], false);
                }
            });
        });

        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            clearFormMessage();
            if (!validate()) {
                showFormMessage('error', 'لطفاً خطاهای مشخص‌شده در فرم را اصلاح کنید.');
                var firstError = form.querySelector('.error');
                if (firstError) firstError.focus();
                return;
            }
            var submit = form.querySelector('button[type="submit"]');
            submit.disabled = true;
            submit.textContent = 'در حال ارسال…';
            try {
                var response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        name: nameEl.value.trim(),
                        phone: toLatinDigits(phoneEl.value.trim()),
                        subject: subjectEl.value,
                        message: messageEl.value.trim(),
                        website: (document.getElementById('website') || {}).value || ''
                    })
                });
                var data = await response.json().catch(function () {return {};});
                if (!response.ok || !data.ok) throw new Error(data.message || 'درخواست ارسال نشد.');
                showFormMessage('success', 'درخواست شما با موفقیت ارسال شد. همکاران کلینیک با شما تماس خواهند گرفت.');
                form.reset();
            } catch (err) {
                showFormMessage('error', (err && err.message) || 'ارسال انجام نشد. لطفاً با ۰۲۱۴۴۲۶۸۱۴۷ تماس بگیرید.');
            } finally {
                submit.disabled = false;
                submit.textContent = 'ارسال درخواست مشاوره';
            }
        });
    })();

    /* ==========================================================================
       8. دکمه بازگشت به بالای صفحه + هدر چسبان
       ========================================================================== */
    (function initScrollUi() {
        var backBtn = $('#backToTop');
        var header = $('#siteHeader');
        var threshold = 300;

        function onScroll() {
            var y = window.pageYOffset || document.documentElement.scrollTop;

            if (backBtn) {
                backBtn.classList.toggle('show', y > threshold);
            }
            if (header) {
                header.classList.toggle('scrolled', y > 20);
            }
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();

        if (backBtn) {
            backBtn.addEventListener('click', function () {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
    })();

    /* ==========================================================================
       9. نمایش سال جاری در فوتر
       ========================================================================== */
    (function initFooterYear() {
        var yearEl = $('#year');
        if (!yearEl) return;
        yearEl.textContent = new Date().getFullYear();
    })();

    /* ==========================================================================
       10. افکت نمایش تدریجی عناصر reveal
       ========================================================================== */
    (function initReveal() {
        var items = $$('.reveal');
        if (!items.length) return;

        if (!('IntersectionObserver' in window)) {
            /* fallback: نمایش همه */
            items.forEach(function (el) { el.classList.add('visible'); });
            return;
        }

        var observer = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
        );

        items.forEach(function (el) { observer.observe(el); });
    })();

    /* ==========================================================================
       11. فعال‌سازی لینک منو بر اساس اسکرول (اختیاری اما مفید)
       ========================================================================== */
    (function initActiveNav() {
        var links = $$('.main-nav a[href^="#"]');
        if (!links.length) return;

        var sections = links
            .map(function (link) {
                var id = link.getAttribute('href');
                if (!id || id === '#') return null;
                var el = document.querySelector(id);
                return el ? { link: link, el: el } : null;
            })
            .filter(Boolean);

        if (!sections.length) return;

        function onScroll() {
            var pos = (window.pageYOffset || document.documentElement.scrollTop) + 120;
            var active = null;
            sections.forEach(function (s) {
                if (s.el.offsetTop <= pos) active = s;
            });
            links.forEach(function (l) { l.classList.remove('active'); });
            if (active) active.link.classList.add('active');
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    })();

    /* ==========================================================================
       12. اسکرول نرم برای لینک‌های لنگر (پشتیبانی از مرورگرهای قدیمی)
       ========================================================================== */
    (function initSmoothScroll() {
        var supportsSmooth = 'scrollBehavior' in document.documentElement.style;
        if (supportsSmooth) return;

        $$('a[href^="#"]').forEach(function (link) {
            link.addEventListener('click', function (e) {
                var href = link.getAttribute('href');
                if (!href || href === '#') return;
                var target = document.querySelector(href);
                if (!target) return;
                e.preventDefault();
                var headerH = $('#siteHeader') ? $('#siteHeader').offsetHeight : 0;
                var top = target.getBoundingClientRect().top + window.pageYOffset - headerH - 10;
                window.scrollTo(0, top);
            });
        });
    })();

})();