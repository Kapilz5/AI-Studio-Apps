import { CreditCard } from '../types';
import { getNotifiedCards, saveNotifiedCards } from './storage';

export const requestPermission = async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
        console.warn("This browser does not support desktop notification");
        return 'denied';
    }

    if (Notification.permission === 'default') {
        return await Notification.requestPermission();
    }
    
    return Notification.permission;
};

const showNotification = (title: string, options?: NotificationOptions) => {
    if (Notification.permission === 'granted') {
        navigator.serviceWorker.getRegistration().then(reg => {
            if (reg) {
                // FIX: The 'vibrate' property is valid for service worker notifications
                // but is missing from the standard NotificationOptions type, causing an error on object literals.
                // We assign the options to a variable with an extended type to bypass the excess property check.
                const notificationOptionsWithVibrate: NotificationOptions & { vibrate?: readonly number[] } = {
                    ...options,
                    icon: 'https://img.icons8.com/fluency/192/wallet.png',
                    badge: 'https://img.icons8.com/fluency/192/wallet.png',
                    vibrate: [200, 100, 200],
                };
                reg.showNotification(title, notificationOptionsWithVibrate);
            } else {
                new Notification(title, options);
            }
        });
    }
};

export const checkAndNotifyForExpiringCards = async (cards: CreditCard[], periodInMonths: number) => {
    if (Notification.permission !== 'granted') {
        console.log("Notification permission not granted. Skipping check.");
        return;
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const notifiedFlags = await getNotifiedCards();
    let updatedFlags = { ...notifiedFlags };
    let hasChanges = false;

    cards.forEach(card => {
        const monthDiff = (card.expiryYear - currentYear) * 12 + (card.expiryMonth - currentMonth);
        const isExpiring = monthDiff >= 0 && monthDiff <= periodInMonths;

        if (isExpiring && !notifiedFlags[card.id]) {
            console.log(`Scheduling notification for expiring card: ${card.name}`);
            showNotification('Card Expiry Warning', {
                body: `${card.name} is expiring on ${String(card.expiryMonth).padStart(2, '0')}/${card.expiryYear}.`,
                tag: `expiry-${card.id}`, 
            });
            updatedFlags[card.id] = true;
            hasChanges = true;
        }
    });

    if (hasChanges) {
        saveNotifiedCards(updatedFlags);
    }
};