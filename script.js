// =======================
// Configuration générale
// =======================

// PaiementPro
const PAYMENT_PRO_MERCHANT_ID = 'PP-F6456';

// URL de retour après paiement
const PAYMENT_PRO_RETURN_URL = 'https://ivoire-electromenagers.com/paiement-retour.html';

// URL de notification (Supabase Edge Function)
const PAYMENT_PRO_NOTIFICATION_URL = 'https://sootfuydjmfwvssjtkni.functions.supabase.co/paiementpro-notification';

// Numéro WhatsApp de la boutique
const STORE_WHATSAPP_NUMBER = '2250141364716';

// Produits du magasin (catalogue local)
const products = [
    {
        id: 1,
        name: 'Réfrigérateur Samsung',
        price: 450000,
        image: 'refrigerateur.png',
        description: 'Réfrigérateur moderne avec congélateur intégré, économe en énergie. Capacité 450L avec contrôle digital.',
        category: 'refrigeration'
    },
    {
        id: 2,
        name: 'Lave-linge LG',
        price: 380000,
        image: 'lavelinge.png',
        description: 'Machine à laver automatique haute capacité avec technologie AI. 8kg de capacité.',
        category: 'washing'
    },
    {
        id: 3,
        name: 'Four Électrique',
        price: 250000,
        image: 'four-electrique.png',
        description: 'Four multifonction avec convection naturelle et chaleur tournante. 60L.',
        category: 'cooking'
    },
    {
        id: 4,
        name: 'Micro-ondes Panasonic',
        price: 120000,
        image: 'microonde.png',
        description: 'Micro-ondes numérique avec 10 niveaux de puissance. 25L.',
        category: 'cooking'
    },
    {
        id: 5,
        name: 'Climatiseur Daikin',
        price: 600000,
        image: 'climatiseur.png',
        description: 'Climatiseur inverter silencieux avec télécommande intelligente. 12000 BTU.',
        category: 'climate'
    },
    {
        id: 6,
        name: 'Aspirateur Bosch',
        price: 180000,
        image: 'aspirateur.png',
        description: 'Aspirateur sans fil puissant avec filtration HEPA. Très silencieux.',
        category: 'other'
    },
    {
        id: 7,
        name: 'Lave-vaisselle Electrolux',
        price: 320000,
        image: 'lavevaisselle.png',
        description: 'Lave-vaisselle 12 couverts avec 5 programmes de lavage. Classe A++.',
        category: 'washing'
    },
    {
        id: 8,
        name: 'Chauffe-eau électrique',
        price: 95000,
        image: 'chauffe-eau.png',
        description: 'Chauffe-eau électrique 200L pour usage domestique. Résistance renforcée.',
        category: 'other'
    }
];

const promoProducts = [
    {
        id: 101,
        name: 'Réfrigérateur Samsung - Offre du mois',
        price: 315000,
        image: 'refrigerateur.png'
    },
    {
        id: 102,
        name: 'Climatiseur Daikin - Offre du mois',
        price: 450000,
        image: 'climatiseur.png'
    },
    {
        id: 103,
        name: 'Lave-linge LG - Offre du mois',
        price: 304000,
        image: 'lavelinge.png'
    }
];

const VALID_CATEGORIES = ['refrigeration', 'washing', 'cooking', 'climate', 'other'];

let cart = [];
let currentProduct = null;
let currentQuantity = 1;
let currentSlide = 0;
let filteredCategory = 'all';
let sliderInterval = null;

// =======================
// Init page
// =======================
document.addEventListener('DOMContentLoaded', function () {
    loadCart();

    if (document.getElementById('productsContainer')) {
        loadProducts();
    }

    if (document.querySelector('.hero-slide')) {
        startSlider();
    }

    initializeAOS();
});

// =======================
// Utils HTML / Sécurité
// =======================
function escapeHTML(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
function escapeAttribute(value) {
    return escapeHTML(value);
}
function getSafeImageSrc(src) {
    const value = String(src ?? '').trim();
    if (/^https?:\/\/[^\s"'<>]+$/i.test(value)) return value;
    if (/^[a-zA-Z0-9_\-./]+\.(png|jpg|jpeg|gif|webp)$/i.test(value)) return value;
    return '';
}

// =======================
// AOS Light
// =======================
function initializeAOS() {
    if (!('IntersectionObserver' in window)) return;
    const elements = document.querySelectorAll('[data-aos]');
    if (elements.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const animationName = entry.target.dataset.aos || 'fadeInUp';
            const delay = Number(entry.target.dataset.aosDelay) || 0;
            entry.target.style.animationDelay = `${delay}ms`;
            entry.target.style.animation = `${animationName} 0.6s ease forwards`;
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.1 });

    elements.forEach(el => observer.observe(el));
}

// =======================
// Slider
// =======================
function startSlider() {
    const slides = document.querySelectorAll('.hero-slide');
    if (slides.length === 0) return;
    if (sliderInterval) clearInterval(sliderInterval);
    sliderInterval = setInterval(() => {
        currentSlide = (currentSlide + 1) % slides.length;
        updateSlider();
    }, 4000);
}
function goToSlide(index) {
    const slides = document.querySelectorAll('.hero-slide');
    if (slides.length === 0) return;
    currentSlide = Math.max(0, Math.min(Number(index) || 0, slides.length - 1));
    updateSlider();
}
function updateSlider() {
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.dot');
    if (slides.length === 0) return;
    slides.forEach((slide, index) => {
        slide.classList.toggle('active', index === currentSlide);
    });
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentSlide);
    });
}

// =======================
// Produits
// =======================
function getCatalogProducts() {
    return [...products];
}

function loadProducts() {
    const productsContainer = document.getElementById('productsContainer');
    if (!productsContainer) return;

    let catalog = getCatalogProducts();
    if (filteredCategory !== 'all') {
        catalog = catalog.filter(product => product.category === filteredCategory);
    }
    displayProducts(catalog);
}

function displayProducts(productsToDisplay) {
    const container = document.getElementById('productsContainer');
    if (!container) return;

    container.innerHTML = '';

    if (!Array.isArray(productsToDisplay) || productsToDisplay.length === 0) {
        container.innerHTML = '<p class="empty-products">Aucun produit trouvé.</p>';
        return;
    }

    productsToDisplay.forEach((product, index) => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.dataset.aos = 'fadeUp';
        card.dataset.aosDelay = String(index * 50);

        const safeImage = getSafeImageSrc(product.image);

        card.innerHTML = `
            <img src="${escapeAttribute(safeImage)}" alt="${escapeAttribute(product.name)}" class="product-image">
            <div class="product-info">
                <h3 class="product-title">${escapeHTML(product.name)}</h3>
                <p class="product-description">${escapeHTML(product.description)}</p>
                <div class="product-footer">
                    <span class="product-price">${formatPrice(product.price)}</span>
                    <button class="btn-add" type="button" onclick="openProductModal(${Number(product.id)})">Voir plus</button>
                </div>
            </div>
        `;

        container.appendChild(card);
    });

    initializeAOS();
}

function filterProducts(category, clickedButton = null) {
    filteredCategory = category;
    document.querySelectorAll('.tag-btn').forEach(btn => btn.classList.remove('active'));
    if (clickedButton) clickedButton.classList.add('active');
    else {
        const activeButton = document.querySelector(`[data-category="${category}"]`);
        if (activeButton) activeButton.classList.add('active');
    }
    loadProducts();
}

// =======================
// Modal Produit
// =======================
function openProductModal(productId) {
    const id = Number(productId);
    currentProduct = getCatalogProducts().find(product => product.id === id);
    currentQuantity = 1;
    if (!currentProduct) return;

    const modalImage = document.getElementById('modalImage');
    const modalTitle = document.getElementById('modalTitle');
    const modalDescription = document.getElementById('modalDescription');
    const modalPrice = document.getElementById('modalPrice');
    const quantityInput = document.getElementById('quantityInput');
    const productModal = document.getElementById('productModal');
    const modalOverlay = document.getElementById('modalOverlay');

    if (!modalImage || !modalTitle || !modalDescription || !modalPrice || !quantityInput || !productModal || !modalOverlay) return;

    modalImage.src = getSafeImageSrc(currentProduct.image);
    modalImage.alt = currentProduct.name;
    modalTitle.textContent = currentProduct.name;
    modalDescription.textContent = currentProduct.description;
    modalPrice.textContent = formatPrice(currentProduct.price);
    quantityInput.value = '1';

    productModal.classList.add('open');
    modalOverlay.classList.add('open');
}

function closeModal() {
    const productModal = document.getElementById('productModal');
    const modalOverlay = document.getElementById('modalOverlay');
    if (productModal) productModal.classList.remove('open');
    if (modalOverlay) modalOverlay.classList.remove('open');
    currentProduct = null;
    currentQuantity = 1;
}

function increaseQuantity() {
    currentQuantity++;
    const quantityInput = document.getElementById('quantityInput');
    if (quantityInput) quantityInput.value = String(currentQuantity);
}

function decreaseQuantity() {
    if (currentQuantity <= 1) return;
    currentQuantity--;
    const quantityInput = document.getElementById('quantityInput');
    if (quantityInput) quantityInput.value = String(currentQuantity);
}

function addToCartFromModal() {
    if (!currentProduct) return;
    const quantityInput = document.getElementById('quantityInput');
    const inputQuantity = quantityInput ? Number(quantityInput.value) : currentQuantity;
    const quantity = Math.max(1, Math.floor(inputQuantity || 1));
    addToCart(currentProduct.id, quantity);
    closeModal();
    showNotification('✓ Produit ajouté au panier!');
}

// =======================
// Panier
// =======================
function addToCart(productId, quantity = 1) {
    const id = Number(productId);
    const cleanQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
    const product = getCatalogProducts().find(item => item.id === id);
    if (!product) {
        showNotification('❌ Produit introuvable.', 'error');
        return;
    }
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) existingItem.quantity += cleanQuantity;
    else cart.push({ id: product.id, name: product.name, price: product.price, image: product.image, quantity: cleanQuantity });
    saveCart();
    updateCartUI();
}

function addPromoToCart(promoId) {
    const id = Number(promoId);
    const product = promoProducts.find(item => item.id === id);
    if (!product) {
        showNotification('❌ Offre introuvable.', 'error');
        return;
    }
    addToCart(product.id, 1);
    showNotification('✓ Offre ajoutée au panier !');
}

function removeFromCart(productId) {
    const id = Number(productId);
    cart = cart.filter(item => item.id !== id);
    saveCart();
    updateCartUI();
}

function clearCart() {
    if (cart.length === 0) {
        showNotification('Votre panier est déjà vide.', 'info');
        return;
    }
    if (!confirm('Voulez-vous vraiment vider le panier ?')) return;
    cart = [];
    saveCart();
    updateCartUI();
    showNotification('🗑️ Panier vidé.');
}

function updateCartQuantity(productId, change) {
    const id = Number(productId);
    const quantityChange = Number(change);
    const item = cart.find(cartItem => cartItem.id === id);
    if (!item || !Number.isFinite(quantityChange)) return;
    item.quantity += quantityChange;
    if (item.quantity <= 0) {
        removeFromCart(id);
        return;
    }
    saveCart();
    updateCartUI();
}

function updateCartUI() {
    const cartItemsDiv = document.getElementById('cartItems');
    const cartCountSpan = document.getElementById('cartCount');
    const cartTotalSpan = document.getElementById('cartTotal');

    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartCountSpan) cartCountSpan.textContent = String(itemCount);

    if (!cartItemsDiv || !cartTotalSpan) return;

    if (cart.length === 0) {
        cartItemsDiv.innerHTML = '<p class="empty-cart">Votre panier est vide</p>';
        cartTotalSpan.textContent = formatPrice(0);
        return;
    }

    cartItemsDiv.innerHTML = cart.map(item => {
        const safeImage = getSafeImageSrc(item.image);
        return `
            <div class="cart-item">
                <img src="${escapeAttribute(safeImage)}" alt="${escapeAttribute(item.name)}" class="cart-item-image">
                <div class="cart-item-info">
                    <div class="cart-item-name">${escapeHTML(item.name)}</div>
                    <div class="cart-item-unit-price">Prix unitaire: ${formatPrice(item.price)}</div>
                    <div class="cart-item-price">Total: ${formatPrice(item.price * item.quantity)}</div>
                </div>
                <div class="cart-item-qty">
                    <button type="button" onclick="updateCartQuantity(${Number(item.id)}, -1)">−</button>
                    <span>${Number(item.quantity)}</span>
                    <button type="button" onclick="updateCartQuantity(${Number(item.id)}, 1)">+</button>
                    <button class="remove-btn" type="button" onclick="removeFromCart(${Number(item.id)})">✕</button>
                </div>
            </div>
        `;
    }).join('');

    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    cartTotalSpan.textContent = formatPrice(total);
}

function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('overlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('open');
}

// =======================
// Checkout
// =======================
function openCheckoutForm() {
    if (cart.length === 0) {
        showNotification('❌ Votre panier est vide!', 'error');
        return;
    }

    const orderSummary = document.getElementById('orderSummary');
    const checkoutTotal = document.getElementById('checkoutTotal');
    const checkoutModal = document.getElementById('checkoutModal');
    const modalOverlay = document.getElementById('modalOverlay');
    if (!orderSummary || !checkoutTotal || !checkoutModal || !modalOverlay) return;

    const summary = cart.map(item => {
        const safeImage = getSafeImageSrc(item.image);
        return `
            <div class="order-item-detailed">
                <img src="${escapeAttribute(safeImage)}" alt="${escapeAttribute(item.name)}" class="order-item-image">
                <div class="order-item-details">
                    <div class="order-item-name">${escapeHTML(item.name)}</div>
                    <div class="order-item-qty">Quantité: <strong>${Number(item.quantity)}</strong></div>
                </div>
                <div class="order-item-calc">
                    <div class="order-item-unit">${formatPrice(item.price)} × ${Number(item.quantity)}</div>
                    <div class="order-item-subtotal">${formatPrice(item.price * item.quantity)}</div>
                </div>
            </div>
        `;
    }).join('');

    orderSummary.innerHTML = summary;
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    checkoutTotal.textContent = formatPrice(total);

    checkoutModal.classList.add('open');
    modalOverlay.classList.add('open');

    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
}

function closeCheckout() {
    const checkoutModal = document.getElementById('checkoutModal');
    const modalOverlay = document.getElementById('modalOverlay');
    if (checkoutModal) checkoutModal.classList.remove('open');
    if (modalOverlay) modalOverlay.classList.remove('open');
}

// =======================
// PaiementPro helpers
// =======================
function splitCustomerName(fullName) {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: 'Client', lastName: 'Ivoire' };
    if (parts.length === 1) return { firstName: parts[0], lastName: 'Client' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function getPaiementProChannel(paymentMethod) {
    const allowedChannels = ['OMCIV2', 'MOMOCI', 'FLOOZ', 'WAVECI', 'CARD'];
    if (allowedChannels.includes(paymentMethod)) return paymentMethod;
    return '';
}

async function startPaiementProPayment(order) {
    try {
        if (typeof PaiementPro === 'undefined') {
            showNotification('❌ PaiementPro non chargé.', 'error');
            console.error('Classe PaiementPro absente (SDK à inclure).');
            return;
        }

        const customer = order.customer || {};
        const nameParts = splitCustomerName(customer.name);
        const paymentReference = `CMD-${order.id}`;
        const channel = getPaiementProChannel(order.paymentMethod);

        if (!channel) {
            showNotification('❌ Moyen de paiement en ligne invalide.', 'error');
            return;
        }
        if (!customer.email) {
            showNotification('❌ Email obligatoire pour le paiement en ligne.', 'error');
            return;
        }
        if (!customer.phone) {
            showNotification('❌ Téléphone obligatoire pour le paiement en ligne.', 'error');
            return;
        }

        showNotification('Initialisation du paiement...', 'info');

        const paiementPro = new PaiementPro(PAYMENT_PRO_MERCHANT_ID);
        paiementPro.amount = Number(order.total);
        paiementPro.channel = channel;
        paiementPro.referenceNumber = paymentReference;

        paiementPro.customerEmail = customer.email;
        paiementPro.customerFirstName = nameParts.firstName;
        paiementPro.customerLastname = nameParts.lastName;
        paiementPro.customerPhoneNumber = customer.phone;

        paiementPro.description = `Commande #${order.id} - Ivoire Électroménagers`;
        paiementPro.countryCurrencyCode = '952';

        paiementPro.returnURL = PAYMENT_PRO_RETURN_URL;
        paiementPro.notificationURL = PAYMENT_PRO_NOTIFICATION_URL;
        paiementPro.returnContext = JSON.stringify({
            order_id: order.id,
            reference: paymentReference,
            source: 'ivoire-electromenagers'
        });

        await paiementPro.getUrlPayment();

        if (paiementPro.success && paiementPro.url) {
            showNotification('Redirection vers PaiementPro...', 'success');
            window.location.href = paiementPro.url;
            return;
        }

        console.error('Erreur PaiementPro:', paiementPro);
        showNotification('❌ Impossible d’initialiser le paiement.', 'error');
    } catch (error) {
        console.error('Erreur paiement PaiementPro:', error);
        showNotification('❌ Erreur lors du lancement du paiement.', 'error');
    }
}

// =======================
// Checkout / processCheckout
// =======================
async function processCheckout(e) {
    e.preventDefault();

    if (cart.length === 0) {
        showNotification('❌ Votre panier est vide!', 'error');
        return;
    }

    const form = e.target;
    const nomInput = form.querySelector('#checkoutName');
    const telephoneInput = form.querySelector('#checkoutPhone');
    const adresseInput = form.querySelector('#checkoutAddress');
    const emailInput = form.querySelector('#checkoutEmail');
    const paiementInput = form.querySelector('#checkoutPayment');

    if (!nomInput || !telephoneInput || !adresseInput || !paiementInput) {
        showNotification('❌ Formulaire incomplet.', 'error');
        return;
    }

    const nom = nomInput.value.trim();
    const telephone = telephoneInput.value.trim();
    const adresse = adresseInput.value.trim();
    const email = emailInput ? emailInput.value.trim() : '';
    const paiement = paiementInput.value;

    if (!nom || !telephone || !adresse || !paiement) {
        showNotification('❌ Veuillez remplir les champs obligatoires.', 'error');
        return;
    }

    const isOnlinePayment = ['OMCIV2', 'MOMOCI', 'FLOOZ', 'WAVECI', 'CARD'].includes(paiement);
    if (isOnlinePayment && !email) {
        showNotification('❌ L’email est obligatoire pour le paiement en ligne.', 'error');
        return;
    }

    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const orderId = Date.now();
    const orderDate = new Date().toLocaleString('fr-FR');

    const paymentLabels = {

        'OMCIV2': 'Orange Money',
        'MOMOCI': 'MoMo CI',
        'FLOOZ': 'Flooz',
        'WAVECI': 'Wave CI',
        'CARD': 'Carte Bancaire',
        'CASH': 'Paiement à la livraison'
    };
    const paymentLabel = paymentLabels[paiement] || paiement;

    const order = {
        id: orderId,
        date: orderDate,
        customer: {
            name: nom,
            phone: telephone,
            address: adresse,
            email: email
        },
        paymentMethod: paiement,
        paymentLabel: paymentLabel,
        total: total,
        items: [...cart]
    };

    if (isOnlinePayment) {
        await startPaiementProPayment(order);
    }

    // Sinon : paiement à la livraison (WhatsApp)
    else {
        const itemsText = order.items.map((item, index) => {
            const lineTotal = item.price * item.quantity;
            return `${index + 1}. ${item.name}
   Quantité : ${item.quantity}
   Prix unitaire : ${formatPrice(item.price)}
   Sous-total : ${formatPrice(lineTotal)}`;
        }).join('\n\n');

        const whatsappMessage = `
Bonjour, je souhaite passer une commande chez Ivoire Électroménagers.

📋 COMMANDE #${order.id}
━━━━━━━━━━━━━━━━━━━━

📅 Date : ${order.date}
📦 Statut : Nouvelle

👤 INFORMATIONS CLIENT
Nom : ${order.customer.name}
Téléphone : ${order.customer.phone}
Email : ${order.customer.email || 'Non fourni'}
Adresse : ${order.customer.address}

🛒 ARTICLES COMMANDÉS
${itemsText}

💰 TOTAL À PAYER : ${formatPrice(order.total)}
💳 Moyen de paiement : ${order.paymentLabel}

🚚 Livraison : Votre commande sera livrée sous 24H.

Merci.
        `.trim();

        const encodedMessage = encodeURIComponent(whatsappMessage);
        const whatsappUrl = `https://wa.me/${STORE_WHATSAPP_NUMBER}?text=${encodedMessage}`;
        window.open(whatsappUrl, '_blank');
    }

    // Dans tous les cas, on nettoie le panier local après l’envoi
    cart = [];
    saveCart();
    updateCartUI();
    closeCheckout();
    form.reset();

    showNotification('✅ Commande enregistrée. Merci !');
}

// =======================
// Newsletter (si tu utilises un formulaire)
// =======================
function subscribeNewsletter(e) {
    e.preventDefault();
    const emailInput = e.target.querySelector('input[type="email"]');
    if (!emailInput || !emailInput.value.trim()) {
        showNotification('❌ Veuillez saisir votre email.', 'error');
        return;
    }
    const email = emailInput.value.trim();
    showNotification(`✓ Merci ! Nous avons bien reçu ${email}.`);
    e.target.reset();
}

// =======================
// Sauvegarde panier
// =======================
function saveCart() {
    try {
        localStorage.setItem('cart', JSON.stringify(cart));
    } catch (error) {
        console.error('Erreur sauvegarde panier:', error);
        showNotification('❌ Impossible de sauvegarder le panier.', 'error');
    }
}

function loadCart() {
    try {
        const saved = localStorage.getItem('cart');
        const parsed = JSON.parse(saved || '[]');
        if (!Array.isArray(parsed)) {
            cart = [];
            updateCartUI();
            return;
        }
        cart = parsed
            .filter(item =>
                item &&
                typeof item.id === 'number' &&
                typeof item.name === 'string' &&
                Number.isFinite(Number(item.price)) &&
                Number.isFinite(Number(item.quantity)) &&
                Number(item.quantity) > 0
            )
            .map(item => ({
                id: Number(item.id),
                name: item.name,
                price: Number(item.price),
                image: String(item.image || ''),
                quantity: Math.max(1, Math.floor(Number(item.quantity)))
            }));
        updateCartUI();
    } catch (error) {
        console.error('Erreur chargement panier:', error);
        cart = [];
        updateCartUI();
    }
}

// =======================
// Format prix & notifications
// =======================
function formatPrice(price) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'XOF',
        maximumFractionDigits: 0
    }).format(Number(price) || 0);
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    const backgrounds = {
        success: 'linear-gradient(135deg, #27ae60, #229954)',
        error: 'linear-gradient(135deg, #e74c3c, #c0392b)',
        info: 'linear-gradient(135deg, #004E89, #0066BB)'
    };
    const background = backgrounds[type] || backgrounds.success;

    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${background};
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        z-index: 2000;
        box-shadow: 0 8px 20px rgba(0,0,0,0.2);
        animation: slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        font-weight: 600;
        max-width: 320px;
    `;

    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.4s ease';
        setTimeout(() => notification.remove(), 400);
    }, 3000);
}

// Animations CSS pour les notifications
(function injectNotificationStyles() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(400px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(400px); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
})();

// Fermer les modals avec Échap
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeModal();
        closeCheckout();
    }
});
