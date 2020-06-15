"use strict";

function ViscousFluidInterpolator() {
    /** Controls the viscous fluid effect (how much of it). */
    var VISCOUS_FLUID_SCALE = 8.0;
    var VISCOUS_FLUID_NORMALIZE;
    var VISCOUS_FLUID_OFFSET;
    
    var viscousFluid = function(x) {
        x *= VISCOUS_FLUID_SCALE;
        if (x < 1.0) {
            x -= (1.0 - Math.exp(-x));
        }
        else {
            var start = 0.36787944117; // 1/e == exp(-1)
            x = 1.0 - Math.exp(1.0 - x);
            x = start + x * (1.0 - start);
        }
        return x;
    }
    // must be set to 1.0 (used in viscousFluid())
    VISCOUS_FLUID_NORMALIZE = 1.0 / viscousFluid(1.0);
    // account for very small floating-point error
    VISCOUS_FLUID_OFFSET = 1.0 - VISCOUS_FLUID_NORMALIZE * viscousFluid(1.0);

    var getInterpolation = this.getInterpolation = function(input) {
        var interpolated = VISCOUS_FLUID_NORMALIZE * viscousFluid(input);
        if (interpolated > 0) {
            return interpolated + VISCOUS_FLUID_OFFSET;
        }
        return interpolated;
    }
}

function Scroller(interpolator, flywheel) {
    var mInterpolator;
    var mMode;
    var mStartX;
    var mStartY;
    var mFinalX;
    var mFinalY;
    var mMinX;
    var mMaxX;
    var mMinY;
    var mMaxY;
    var mCurrX;
    var mCurrY;
    var mStartTime;
    var mDuration;
    var mDurationReciprocal;
    var mDeltaX;
    var mDeltaY;
    var mFinished;
    var mFlywheel;
    var mVelocity;
    var mCurrVelocity;
    var mDistance;
    var mFlingFriction = 0.5;
    var DEFAULT_DURATION = 250;
    var SCROLL_MODE = 0;
    var FLING_MODE = 1;
    var DECELERATION_RATE = (Math.log(0.78) / Math.log(0.9));
    var INFLEXION = 0.35; // Tension lines cross at (INFLEXION, 1)
    var START_TENSION = 0.5;
    var END_TENSION = 1.0;
    var P1 = START_TENSION * INFLEXION;
    var P2 = 1.0 - END_TENSION * (1.0 - INFLEXION);
    var NB_SAMPLES = 100;
    var SPLINE_POSITION = new Array(NB_SAMPLES + 1);
    var SPLINE_TIME = new Array(NB_SAMPLES + 1);
    var mDeceleration;
    var mPpi;
    // A context-specific coefficient adjusted to physical values.
    var mPhysicalCoeff; {
        var x_min = 0.0;
        var y_min = 0.0;
        for (var i = 0; i < NB_SAMPLES; i++) {
            var alpha = i / NB_SAMPLES;
            var x_max = 1.0;
            var x, tx, coef;
            while (true) {
                x = x_min + (x_max - x_min) / 2.0;
                coef = 3.0 * x * (1.0 - x);
                tx = coef * ((1.0 - x) * P1 + x * P2) + x * x * x;
                if (Math.abs(tx - alpha) < 1E-5) break;
                if (tx > alpha) x_max = x;
                else x_min = x;
            }
            SPLINE_POSITION[i] = coef * ((1.0 - x) * START_TENSION + x) + x * x * x;
            var y_max = 1.0;
            var y, dy;
            while (true) {
                y = y_min + (y_max - y_min) / 2.0;
                coef = 3.0 * y * (1.0 - y);
                dy = coef * ((1.0 - y) * START_TENSION + y) + y * y * y;
                if (Math.abs(dy - alpha) < 1E-5) break;
                if (dy > alpha) y_max = y;
                else y_min = y;
            }
            SPLINE_TIME[i] = coef * ((1.0 - y) * P1 + y * P2) + y * y * y;
        }
        SPLINE_POSITION[NB_SAMPLES] = SPLINE_TIME[NB_SAMPLES] = 1.0;
    }

    /**
     * The amount of friction applied to flings. The default value
     * is {@link ViewConfiguration#getScrollFriction}.
     * 
     * @param friction A scalar dimension-less value representing the coefficient of
     *         friction.
     */
    var setFriction = this.setFriction = function(friction) {
        mDeceleration = computeDeceleration(friction);
        mFlingFriction = friction;
    }
    const GRAVITY_EARTH = 9.81;
    var computeDeceleration = this.computeDeceleration = function(friction) {
        return GRAVITY_EARTH // g (m/s^2)
            *
            39.37 // inch/meter
            *
            mPpi // pixels per inch
            *
            friction;
    }
    /**
     * 
     * Returns whether the scroller has finished scrolling.
     * 
     * @return True if the scroller has finished scrolling, false otherwise.
     */
    var isFinished = this.isFinished = function() {
        return mFinished;
    }

    /**
     * Force the finished field to a particular value.
     *  
     * @param finished The new finished value.
     */
    var forceFinished = this.forceFinished = function(finished) {
        mFinished = finished;
    }

    /**
     * Returns how var the scroll event will take, in milliseconds.
     * 
     * @return The duration of the scroll in milliseconds.
     */
    var getDuration = this.getDuration = function() {
        return mDuration;
    }

    /**
     * Returns the current X offset in the scroll. 
     * 
     * @return The new X offset as an absolute distance from the origin.
     */
    var getCurrX = this.getCurrX = function() {
        return mCurrX;
    }

    /**
     * Returns the current Y offset in the scroll. 
     * 
     * @return The new Y offset as an absolute distance from the origin.
     */
    var getCurrY = this.getCurrY = function() {
        return mCurrY;
    }

    /**
     * Returns the current velocity.
     *
     * @return The original velocity less the deceleration. Result may be
     * negative.
     */
    var getCurrVelocity = this.getCurrVelocity = function() {
        return mMode == FLING_MODE ?
            mCurrVelocity : mVelocity - mDeceleration * timePassed() / 2000.0;
    }
    /**
     * Returns the start X offset in the scroll. 
     * 
     * @return The start X offset as an absolute distance from the origin.
     */
    var getStartX = this.getStartX = function() {
        return mStartX;
    }

    /**
     * Returns the start Y offset in the scroll. 
     * 
     * @return The start Y offset as an absolute distance from the origin.
     */
    var getStartY = this.getStartY = function() {
        return mStartY;
    }

    /**
     * Returns where the scroll will end. Valid only for "fling" scrolls.
     * 
     * @return The const X offset as an absolute distance from the origin.
     */
    var getFinalX = this.getFinalX = function() {
        return mFinalX;
    }

    /**
     * Returns where the scroll will end. Valid only for "fling" scrolls.
     * 
     * @return The const Y offset as an absolute distance from the origin.
     */
    var getFinalY = this.getFinalY = function() {
        return mFinalY;
    }
    /**
     * Call this when you want to know the new location.  If it returns true,
     * the animation is not yet finished.
     */
    var computeScrollOffset = this.computeScrollOffset = function() {
        if (mFinished) {
            return false;
        }
        timePassed = new Date().getMilliseconds() - mStartTime;

        if (timePassed < mDuration) {
            switch (mMode) {
                case SCROLL_MODE:
                    var x = mInterpolator.getInterpolation(timePassed * mDurationReciprocal);
                    mCurrX = mStartX + Math.round(x * mDeltaX);
                    mCurrY = mStartY + Math.round(x * mDeltaY);
                    break;
                case FLING_MODE:
                    var t = timePassed / mDuration;
                    const index = (NB_SAMPLES * t);
                    var distanceCoef = 1;
                    var velocityCoef = 0;
                    if (index < NB_SAMPLES) {
                        var t_inf = index / NB_SAMPLES;
                        var t_sup = (index + 1) / NB_SAMPLES;
                        var d_inf = SPLINE_POSITION[index];
                        var d_sup = SPLINE_POSITION[index + 1];
                        velocityCoef = (d_sup - d_inf) / (t_sup - t_inf);
                        distanceCoef = d_inf + (t - t_inf) * velocityCoef;
                    }
                    mCurrVelocity = velocityCoef * mDistance / mDuration * 1000.0;

                    mCurrX = mStartX + Math.round(distanceCoef * (mFinalX - mStartX));
                    // Pin to mMinX <= mCurrX <= mMaxX
                    mCurrX = Math.min(mCurrX, mMaxX);
                    mCurrX = Math.max(mCurrX, mMinX);

                    mCurrY = mStartY + Math.round(distanceCoef * (mFinalY - mStartY));
                    // Pin to mMinY <= mCurrY <= mMaxY
                    mCurrY = Math.min(mCurrY, mMaxY);
                    mCurrY = Math.max(mCurrY, mMinY);
                    if (mCurrX == mFinalX && mCurrY == mFinalY) {
                        mFinished = true;
                    }
                    break;
            }
        }
        else {
            mCurrX = mFinalX;
            mCurrY = mFinalY;
            mFinished = true;
        }
        return true;
    }

    /**
     * Start scrolling by providing a starting point, the distance to travel,
     * and the duration of the scroll.
     * 
     * @param startX Starting horizontal scroll offset in pixels. Positive
     *        numbers will scroll the content to the left.
     * @param startY Starting vertical scroll offset in pixels. Positive numbers
     *        will scroll the content up.
     * @param dx Horizontal distance to travel. Positive numbers will scroll the
     *        content to the left.
     * @param dy Vertical distance to travel. Positive numbers will scroll the
     *        content up.
     * @param duration Duration of the scroll in milliseconds.
     */
    var startScroll = this.startScroll = function(startX, startY, dx, dy, duration) {
        if (duration === undefined)
            duration = DEFAULT_DURATION;
        mMode = SCROLL_MODE;
        mFinished = false;
        mDuration = duration;
        mStartTime = new Date().getMilliseconds();
        mStartX = startX;
        mStartY = startY;
        mFinalX = startX + dx;
        mFinalY = startY + dy;
        mDeltaX = dx;
        mDeltaY = dy;
        mDurationReciprocal = 1.0 / mDuration;
    }
    /**
     * Start scrolling based on a fling gesture. The distance travelled will
     * depend on the initial velocity of the fling.
     * 
     * @param startX Starting point of the scroll (X)
     * @param startY Starting point of the scroll (Y)
     * @param velocityX Initial velocity of the fling (X) measured in pixels per
     *        second.
     * @param velocityY Initial velocity of the fling (Y) measured in pixels per
     *        second
     * @param minX Minimum X value. The scroller will not scroll past this
     *        point.
     * @param maxX Maximum X value. The scroller will not scroll past this
     *        point.
     * @param minY Minimum Y value. The scroller will not scroll past this
     *        point.
     * @param maxY Maximum Y value. The scroller will not scroll past this
     *        point.
     */
    var fling = this.fling = function(startX, startY, velocityX, velocityY,
        minX, maxX, minY, maxY) {
        // Continue a scroll or fling in progress
        if (mFlywheel && !mFinished) {
            var oldVel = getCurrVelocity();
            var dx = (mFinalX - mStartX);
            var dy = (mFinalY - mStartY);
            var hyp = Math.hypot(dx, dy);
            var ndx = dx / hyp;
            var ndy = dy / hyp;
            var oldVelocityX = ndx * oldVel;
            var oldVelocityY = ndy * oldVel;
            if (Math.sign(velocityX) == Math.sign(oldVelocityX) &&
                Math.sign(velocityY) == Math.sign(oldVelocityY)) {
                velocityX += oldVelocityX;
                velocityY += oldVelocityY;
            }
        }
        mMode = FLING_MODE;
        mFinished = false;
        var velocity = Math.hypot(velocityX, velocityY);

        mVelocity = velocity;
        mDuration = getSplineFlingDuration(velocity);
        mStartTime = new Date().getMilliseconds();
        mStartX = startX;
        mStartY = startY;
        var coeffX = velocity == 0 ? 1.0 : velocityX / velocity;
        var coeffY = velocity == 0 ? 1.0 : velocityY / velocity;
        var totalDistance = getSplineFlingDistance(velocity);
        mDistance = (totalDistance * Math.sign(velocity));

        mMinX = minX;
        mMaxX = maxX;
        mMinY = minY;
        mMaxY = maxY;
        mFinalX = startX + Math.round(totalDistance * coeffX);
        // Pin to mMinX <= mFinalX <= mMaxX
        mFinalX = Math.min(mFinalX, mMaxX);
        mFinalX = Math.max(mFinalX, mMinX);

        mFinalY = startY + Math.round(totalDistance * coeffY);
        // Pin to mMinY <= mFinalY <= mMaxY
        mFinalY = Math.min(mFinalY, mMaxY);
        mFinalY = Math.max(mFinalY, mMinY);
    }

    var getSplineDeceleration = function(velocity) {
        return Math.log(INFLEXION * Math.abs(velocity) / (mFlingFriction * mPhysicalCoeff));
    }
    var getSplineFlingDuration = function(velocity) {
        var l = getSplineDeceleration(velocity);
        var decelMinusOne = DECELERATION_RATE - 1.0;
        return 1000.0 * Math.exp(l / decelMinusOne);
    }
    var getSplineFlingDistance = function(velocity) {
        var l = getSplineDeceleration(velocity);
        var decelMinusOne = DECELERATION_RATE - 1.0;
        return mFlingFriction * mPhysicalCoeff * Math.exp(DECELERATION_RATE / decelMinusOne * l);
    }
    /**
     * Stops the animation. Contrary to {@link #forceFinished(var)},
     * aborting the animating cause the scroller to move to the const x and y
     * position
     *
     * @see #forceFinished(var)
     */
    var abortAnimation = this.abortAnimation = function() {
        mCurrX = mFinalX;
        mCurrY = mFinalY;
        mFinished = true;
    }

    /**
     * Extend the scroll animation. This allows a running animation to scroll
     * further and longer, when used with {@link #setFinalX()} or {@link #setFinalY()}.
     *
     * @param extend Additional time to scroll in milliseconds.
     * @see #setFinalX()
     * @see #setFinalY()
     */
    var extendDuration = this.extendDuration = function(extend) {
        var passed = timePassed();
        mDuration = passed + extend;
        mDurationReciprocal = 1.0 / mDuration;
        mFinished = false;
    }
    /**
     * Returns the time elapsed since the beginning of the scrolling.
     *
     * @return The elapsed time in milliseconds.
     */
    var timePassed = this.timePassed = function() {
        return new Date().getMilliseconds() - mStartTime;
    }
    /**
     * Sets the const position (X) for this scroller.
     *
     * @param newX The new X offset as an absolute distance from the origin.
     * @see #extendDuration()
     * @see #setFinalY()
     */
    var setFinalX = function(newX) {
        mFinalX = newX;
        mDeltaX = mFinalX - mStartX;
        mFinished = false;
    }
    /**
     * Sets the const position (Y) for this scroller.
     *
     * @param newY The new Y offset as an absolute distance from the origin.
     * @see #extendDuration()
     * @see #setFinalX()
     */
    var setFinalY = function(newY) {
        mFinalY = newY;
        mDeltaY = mFinalY - mStartY;
        mFinished = false;
    }
    /**
     * @hide
     */
    var isScrollingInDirection = this.isScrollingInDirection = function(xvel, yvel) {
        return !mFinished && Math.sign(xvel) == Math.sign(mFinalX - mStartX) &&
            Math.sign(yvel) == Math.sign(mFinalY - mStartY);
    }
    mFinished = true;
    if (!interpolator) {
        mInterpolator = new ViscousFluidInterpolator();
    }
    else {
        mInterpolator = interpolator;
    }
    mPpi = 160.0;
    mDeceleration = computeDeceleration(0.5);
    mFlywheel = flywheel;
    mPhysicalCoeff = computeDeceleration(0.84); // look and feel tuning
    
}
var scroller = new Scroller()
scroller.computeDeceleration(0.5)