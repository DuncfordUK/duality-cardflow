import { gsap } from 'gsap';

export function animateDraw(el: HTMLElement, fanRot: number, duration: number): Promise<void> {
  return new Promise((resolve) => {
    gsap.fromTo(
      el,
      { y: -140, rotation: fanRot - 12, scale: 0.65, opacity: 0 },
      {
        y: 0,
        rotation: fanRot,
        scale: 1,
        opacity: 1,
        duration: duration / 1000,
        ease: 'back.out(1.6)',
        onComplete: resolve,
      }
    );
  });
}

export function animatePlay(el: HTMLElement, duration: number): Promise<void> {
  return new Promise((resolve) => {
    gsap.to(el, {
      y: -220,
      scale: 1.25,
      opacity: 0,
      rotation: '+=8',
      duration: duration / 1000,
      ease: 'power2.in',
      onComplete: resolve,
    });
  });
}

export function animateDiscard(el: HTMLElement, duration: number): Promise<void> {
  return new Promise((resolve) => {
    gsap.to(el, {
      x: 80,
      y: 60,
      scale: 0.7,
      opacity: 0,
      rotation: '+=20',
      duration: (duration * 0.7) / 1000,
      ease: 'power1.in',
      onComplete: resolve,
    });
  });
}

export function animateFanReflow(
  elements: HTMLElement[],
  rotations: number[],
  duration: number
): void {
  elements.forEach((el, i) => {
    gsap.to(el, {
      rotation: rotations[i],
      duration: (duration * 0.5) / 1000,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  });
}

export function animateHoverEnter(el: HTMLElement): void {
  gsap.to(el, { y: -28, scale: 1.09, duration: 0.22, ease: 'back.out(2)', overwrite: 'auto' });
}

export function animateHoverLeave(el: HTMLElement, fanRot: number): void {
  gsap.to(el, {
    y: 0,
    scale: 1,
    rotation: fanRot,
    duration: 0.28,
    ease: 'power2.out',
    overwrite: 'auto',
  });
}

export function animateSpotlightOpen(el: HTMLElement, duration: number): Promise<void> {
  return new Promise((resolve) => {
    gsap.fromTo(
      el,
      { y: 110, scale: 0.58, opacity: 0, rotation: -2 },
      {
        y: 0,
        scale: 1,
        opacity: 1,
        rotation: 0,
        duration: duration / 1000,
        ease: 'back.out(1.7)',
        onComplete: resolve,
      }
    );
  });
}

export function animateSpotlightClose(el: HTMLElement, duration: number): Promise<void> {
  return new Promise((resolve) => {
    gsap.to(el, {
      y: 90,
      scale: 0.62,
      opacity: 0,
      duration: duration / 1000,
      ease: 'power2.in',
      onComplete: resolve,
    });
  });
}
