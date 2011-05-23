/*
 * Waterwheel Carousel
 * Version 1.3
 * http://www.bkosborne.com
 *
 * Copyright 2011 Brian Osborne
 * Licensed under GPL version 3
 * http://www.gnu.org/licenses/gpl.txt
 * 
 * Plugin written by Brian Osborne
 * for use with the jQuery JavaScript Framework
 * http://www.jquery.com
 *
 */
(function ($) {

  $.fn.waterwheelCarousel = function (options) {

    // override the default options with user defined options
    options = $.extend({}, $.fn.waterwheelCarousel.defaults, options || {});

    return $(this).each(function () {

      /* These are univeral values that are used throughout the plugin. Do not modify them
       * unless you know what you're doing. Most of them feed off the options
       * so most customization can be achieved by modifying the options values */
      var data = {
        itemsContainer:         $(this).find(".carousel-images"),
        totalItems:             $(this).find(".carousel-images img").length,
        containerWidth:         $(this).width(),
        containerHeight:        $(this).height(),
        currentCenterItem:      null,
        items:                  [],
        itemDistances:          [],
        waveDistances:          [],
        itemWidths:             [],
        itemHeights:            [],
        itemOpacities:          [],
        carouselRotationsLeft:  0,
        currentlyMoving:        false,
        itemsAnimating:         0,
        currentSpeed:           options.speed,
        intervalTimer:          null
      };

      // Setup the carousel
      beforeLoaded();
      // Preload the images. Once they are preloaded, the passed in function
      // will be called and the carousel will be setup
      preload(function () {
        setupDistanceArrays();
        setupCarousel();
        setupStarterRotation();
      });

      /**
       * This function will set the autoplay for the carousel to
       * automatically rotate it given the time in the options
       * Can clear the autoplay by passing in true
       */
      function autoPlay(stop) {
        // clear timer
        clearTimeout(data.autoPlayTimer);
        // as long as no stop command, and autoplay isn't zeroed...
        if (!stop && options.autoPlay !== 0) {
          // set timer...
          data.autoPlayTimer = setTimeout(function () {
            // to move the carousl in either direction...
            if (options.autoPlay > 0) {
              moveOnce(false);
            } else {
              moveOnce(true);
            }
          }, Math.abs(options.autoPlay));
        }
      }

      // get previous feature number - accounts for wrap around
      function getPreviousNum(num) {
        var newNum = (num === 1) ? null : num - 1;
        return newNum;
      }

      // get next feature number - accounts for wrap around
      function getNextNum(num) {
        var newNum = (num === data.totalItems) ? null : num + 1;
        return newNum;
      }

      // We want to hide all the images to make sure the viewer doesn't
      // see them before the carousel moves them to proper positions
      function beforeLoaded() {
        data.itemsContainer.find('img').hide();
      }

      /**
       * This function will preload all the images in the carousel before
       * calling the passed in callback function. This is VERY necessary for
       * the carousel to function properly because it depends heavily on the
       * width and height of images (which can only be determined post-load)
       */
      function preload(callback) {
        var $imageElements = data.itemsContainer.find('img'), loadedImages = 0, totalImages = $imageElements.length;

        $imageElements.each(function () {
          // Attempt to load the images
          $(this).load(function () {
            // Add to number of images loaded and see if they are all done yet
            loadedImages += 1;
            if (loadedImages === totalImages) {
              // All done, perform callback
              callback();
            }
          });
          // The images may already be cached in the browser, in which case they
          // would have a 'true' complete value and the load callback would never be
          // fired. This will fire it manually.
          if (this.complete || $.browser.msie) {
            $(this).trigger('load');
          }
        });
      }

      /**
       * This function will setup the various distance arrays that are used in the carousel
       * These values are calculated beforehand to reduce calculation time while the
       * carousel is moving
       */
      function setupDistanceArrays() {
        // Start each array with the first starting value from the options
        data.itemDistances[0] = options.startingItemSeparation;
        data.waveDistances[0] = options.startingWaveSeparation;
        data.itemWidths[0] = data.itemsContainer.find('img:first').width();
        data.itemHeights[0] = data.itemsContainer.find('img:first').height();
        data.itemOpacities[0] = (1 * options.opacityDecreaseFactor);
        // Then go thru and calculate the rest of the values all the way up to
        // either edge and beyond 1 (to account for the hidden items)
        var i;
        for (i = 1; i < options.flankingItems + 1; i++) {
          data.itemDistances[i] = data.itemDistances[i-1] * options.itemSeparationFactor;
          data.waveDistances[i] = data.waveDistances[i-1] * options.waveSeparationFactor;
          data.itemWidths[i] = data.itemWidths[i-1] * options.itemDecreaseFactor;
          data.itemHeights[i] = data.itemHeights[i-1] * options.itemDecreaseFactor;
          data.itemOpacities[i] = data.itemOpacities[i-1] * options.opacityDecreaseFactor;
          // add one more for width and height
          if (i === options.flankingItems) {
            data.itemWidths[i+1] = data.itemWidths[i] * options.itemDecreaseFactor;
            data.itemHeights[i+1] = data.itemHeights[i] * options.itemDecreaseFactor;
          }
        }
        // The last opacity should be zero
        data.itemOpacities[data.itemOpacities.length-1] = 0;
      }

      /**
       * This function will perform the necessary steps to setup the carousel and the items
       * within it. This mostly means positioning the elements properly and setting
       * their data values
       */
      function setupCarousel() {
        // Fill in a data array with jQuery objects of all the images
        data.items = data.itemsContainer.find('img');
        var i;
        for (i = 0; i < data.items.length; i++) {
          data.items[i] = $(data.items[i]);
        }

        data.itemsContainer
          // Want the container to have relative positioning
          .css('position','relative')
          .find('img')
            .each(function (i) {
              // Put all images in the center default position
              var newLeft,newTop;
              if (options.orientation === "horizontal") {
                newLeft = (data.containerWidth / 2) - ($(this).width() / 2);
                newTop = options.centerOffset;
              } else {
                newLeft = options.centerOffset;
                newTop = (data.containerHeight / 2) - ($(this).height() / 2);
              }
              $(this)
                // Apply positioning and layering to the images
                .css({
                  'left': newLeft,
                  'top': newTop,
                  'visibility': 'visible',
                  'position': 'absolute',
                  'z-index': options.flankingItems+2,
                  'opacity': 1
                })
                // Give each image a data object so it remembers specific data about
                // it's original form
                .data({
                  currentPosition:  0,
                  oldPosition:      0,
                  width:            $(this).width(),
                  owidth:           $(this).width(),
                  height:           $(this).height(),
                  oheight:          $(this).height(),
                  top:              newTop,
                  left:             newLeft,
                  opacity:          1,
                  index:            i
                })
                // The image has been setup... Now we can show it
                .show();
            });
      }

      /**
       * All the items to the left and right of the center item need to be
       * animated to their starting positions. This function will
       * figure out what items go where and will animate them there
       */
      function setupStarterRotation() {
        // Do we need to calculate the starting item?
        options.startingItem = (options.startingItem === 0) ? Math.round(data.totalItems / 2) : options.startingItem;
      
        // We will be rotating the carousel, so we set the animation queue to one
        data.carouselRotationsLeft = 1;
        
        // add active class to center item
        data.items[options.startingItem-1].addClass(options.activeClassName);
        // fire movedToCenter callback manually - since this item never animates to the center
        options.movedToCenter(data.items[options.startingItem-1]);
        // set current center item
        data.currentCenterItem = data.items[options.startingItem-1];

        var counter, itemNum, i;
        counter = 1;
        // Move all the left side items to their proper positions
        for (itemNum = options.startingItem - 2; itemNum >= 0; itemNum--) {
          for (i = 0; i < counter; i++) {
            moveItem(data.items[itemNum],false);
          }
          counter++;
        }

        counter = 1;
        // Move all the right side items to their proper positions
        for (itemNum = options.startingItem; itemNum < data.items.length; itemNum++) {
          for (i = 0; i < counter; i++) {
            moveItem(data.items[itemNum],true);
          }
          counter++;
        }
      }

      /**
       * Given the item and position, this function will calculate the new data
       * for the item. One the calculations are done, it will store that data in
       * the items data object
       */
      function performCalculations($item, newPosition) {

        // Distance to the center
        var oldPosition = $item.data().currentPosition;
        var newDistanceFromCenter = Math.abs(newPosition);

        /** CALCULATE THE NEW WIDTH AND HEIGHT OF THE ITEM **/
        var newWidth = data.itemWidths[newDistanceFromCenter];
        var newHeight = data.itemHeights[newDistanceFromCenter];
        var widthDifference = Math.abs($item.data().width - newWidth);
        var heightDifference = Math.abs($item.data().height - newHeight);

        /** CALCULATE THE NEW WAVE SEPARATION OF THE ITEM **/
        var waveSeparation = 0, centeringNumber;
        // number to center item on horizon (vertical or horizontal)
        if (options.orientation === "horizontal") {
          centeringNumber = heightDifference / 2;
        } else {
          centeringNumber = widthDifference / 2;
        }
        // Item growing
        if ((newPosition > -1 && (newPosition < oldPosition)) || (newPosition < 1 && (newPosition > oldPosition))) {
          // center item along the horizon
          waveSeparation -= centeringNumber;
          // now add the wave
          waveSeparation += data.waveDistances[Math.abs(newPosition)];
        // Item shrinking
        } else if ((newPosition > -1 && (newPosition > oldPosition)) || (newPosition < 1 && (newPosition < oldPosition))) {
          // center item along the horizon
          waveSeparation += centeringNumber;
          // now subtract the wave
          waveSeparation -= data.waveDistances[Math.abs(newPosition) - 1];
        }

        /** CALCULATE THE NEW ITEM SEPARATION OF THE ITEM **/
        var itemSeparation = 0;
        // if moving towards the center, the separation value will be different
        // than if it were moving away from the center
        if (Math.abs(newPosition) < Math.abs(oldPosition)) {
          itemSeparation = data.itemDistances[Math.abs(newPosition)];
        // if not moving towards center, just give it normal positioning
        } else {
          itemSeparation = data.itemDistances[Math.abs(newPosition)-1];
        }
        // Need to account for additional size separation only if the item is
        // on the right side or moving to the center from the right side
        if (newPosition > 0 || (newPosition === 0 && oldPosition === 1)) {
          if (options.orientation === "horizontal") {
            itemSeparation += widthDifference;
          } else {
            itemSeparation += heightDifference;
          }
        }
        // We want to separation to be negative if the image is going towards the left
        if (newPosition < oldPosition) {
          itemSeparation = itemSeparation * -1;
        }

        /** CALCULATE NEW OPACITY OF THE ITEM **/
        var newOpacity;
        if (newPosition === 0) {
          newOpacity = 1;
        } else {
          newOpacity = data.itemOpacities[Math.abs(newPosition)-1];
        }

        // Figure out the new top and left values based on the orientation
        var newTop = $item.data().top;
        var newLeft = $item.data().left;
        if (options.orientation === "horizontal") {
          newTop = $item.data().top + waveSeparation;
          newLeft = $item.data().left + itemSeparation;
        } else {
          newTop = $item.data().top + itemSeparation;
          newLeft = $item.data().left + waveSeparation;
        }

        // Depth will be reverse distance from center
        var newDepth = options.flankingItems + 2 - newDistanceFromCenter;
        // Set calculations
        $item.data('width',newWidth);
        $item.data('height',newHeight);
        $item.data('top',newTop);
        $item.data('left',newLeft);
        $item.data('oldPosition',oldPosition);
        $item.data('currentPosition',newPosition);
        $item.data('depth',newDepth);
        $item.data('opacity',newOpacity);
      }

      /**
       * This function is called when moving an item in the given direction.
       * It will figure out the new position based on the direction of the carousel
       * and then obtain the new calcuations for the item and apply them
       */
      function moveItem($item, direction) {
        // Get old and new positions
        var oldPosition = $item.data('currentPosition'), newPosition;
        
        if (direction === false) {
          newPosition = oldPosition - 1;
        } else {
          newPosition = oldPosition + 1;
        }
        
        // Only want to physically move the item if it is within the boundaries
        // or in the first position just outside either boundary
        if (Math.abs(newPosition) <= options.flankingItems + 1) {
          // increment number of items animating
          data.itemsAnimating++;
          // Obtain the updated data values for the item
          performCalculations($item, newPosition);
          // NOTE: After this method is called, the items data object has updated
          // position values
          
          // is item moving to center?
          if (newPosition === 0) { options.movingToCenter($item); }
          // is item moving away from center?
          if (oldPosition === 0) {
            options.movingFromCenter($item); // fire callback
            $item.removeClass(options.activeClassName);
          }

          // Change depth of item right away based on its new position
          $item.css('z-index',$item.data().depth);
          $item
            // Animate the items to their new position values
            .animate({
              left: $item.data().left,
              width: $item.data().width,
              height: $item.data().height,
              top: $item.data().top,
              opacity: $item.data().opacity
            },data.currentSpeed,options.animationEasing, function () {
              // Animation for the item has completed, call method
              itemAnimationComplete($item, newPosition, direction);
            });
        // If the item is moving further outside of the boundary, don't move it,
        // just increment its position
        } else if (Math.abs(newPosition) > options.flankingItems) {
          $item.data('oldPosition',oldPosition);
          $item.data('currentPosition',newPosition);
        }

      }

      /**
       * This function is called once an item has finished animating to its
       * given position. Several different statements are executed here, such as
       * dealing with the animation queue
       */
      function itemAnimationComplete($item, newPosition, direction) {
        // If the item moved to the center position, change the data indicating so
        // We simply need to keep track of it so we can call the moved to center event
        // once we are positive all of the animations are complete
        if (newPosition === 0) {
          data.currentCenterItem = $item;
          // add active class to item
          $item.addClass(options.activeClassName);
        }
        
        // Was this item moved away from the center? fire callback
        if ($item.data().oldPosition === 0) {
          options.movedFromCenter($item);
        }

        // Decrement one from the amount of items that are animating
        data.itemsAnimating--;
        // If there are no more items left animating, that means that all the items within
        // the carousel have finished animating
        if (data.itemsAnimating === 0) {
          // Decrement one from the amount of rotations the carousel has made
          data.carouselRotationsLeft -= 1;
          // The carousel has finished rotating and is no longer moving
          data.currentlyMoving = false;
          // If there are still rotations left in the queue, rotate the carousel again
          // we pass in zero because we don't want to add any additional rotations
          if (data.carouselRotationsLeft > 0) {
            rotateCarousel(direction, 0);
          // Otherwise there are no more rotations and...
          } else {
            // Reset the speed of the carousel to original
            data.currentSpeed = options.speed;
            // Trigger custom 'moved to the center' event
            if (data.currentCenterItem !== null) {
              options.movedToCenter(data.currentCenterItem);
            }
            // reset & initate the autoPlay
            autoPlay();
          }
        }
      }

      function stopAnimations() {
        var i;
        for (i = 0; i < data.items.length; i++) {
          data.items[i].stop();
        }
      }

      // Short function to determine if a rotation is allowed or not
      function rotationAllowed(direction) {
        // Deny if currently moving already
        if (data.currentlyMoving === true) {
          return false;
        }
        // Deny if trying to move to right and already at right-most item
        if (direction === true && data.items[0].data().currentPosition === 0) {
          return false;
        }
        // Deny if trying to move to left and already at left-most item
        if (direction === false && data.items[data.totalItems-1].data().currentPosition === 0) {
          return false;
        }
        
        // Everything is OKAY
        return true;
      }

      /**
       * Function called to rotate the carousel the given number of rotations
       * in the given direciton. Will check to make sure the carousel should
       * be able to move, and then adjust speed and move items
       */
      function rotateCarousel(direction, rotations) {

        // Check to see that a rotation is allowed
        if (rotationAllowed(direction)) {

          // Carousel is now moving
          data.currentlyMoving = true;
          // Reset items animating to zero
          data.itemsAnimating = 0;
          // Add given rotations to queue
          data.carouselRotationsLeft += rotations;
          
          if (options.quickerForFurther === true) {
	          // Figure out how fast the carousel should rotate
	          if (rotations > 1) {
	            data.currentSpeed = options.speed / rotations;
	          }
	          // Assure the speed is above the minimum to avoid weird results
	          data.currentSpeed = (data.currentSpeed < 100) ? 100 : data.currentSpeed;
          } else {
            data.currentSpeed = options.speed;
          }

          // Iterate thru each item and move it
          var i;
          for (i = 0; i < data.items.length; i++) {
            var $item = $(data.items[i]);
            var currentPosition = $item.data().currentPosition;
            // Only move items that are within the boundaries of the carousel
            // (but also the first flanking hidden item on either side if there is one)
            if (currentPosition >= ((options.flankingItems*-1)-1) && currentPosition <= (options.flankingItems)+1) {
              moveItem($item, direction);
            // If the item is not in the boundaries, then that means it is a hidden flank image
            // we don't want to move it, but we want to increment it's position
            } else {
              $item.data('oldPosition',currentPosition);
              if (direction === true) {
                $item.data('currentPosition',currentPosition+1);
              } else {
                $item.data('currentPosition',currentPosition-1);
              }
            }
          }
        }
      }
      
      /**
       * These two functions are called anytime the carousel should move to the left
       * or the right once. A check is make to see if an edge has been hit. If so,
       * the carousel is reset to the other end
       **/
      function moveOnce(direction) {
        var currentCenterIndex = data.currentCenterItem.data().index;
        // check if the user is trying to go past an edge
        if ((currentCenterIndex === 0 && direction === true) || (currentCenterIndex === (data.totalItems-1) && direction === false)) {
          // kill the timer until the animation is done
          clearTimeout(data.autoPlayTimer);
          
          if (options.edgeReaction === 'reset') {
            // reset carousel to opposite side
            rotateCarousel(!direction,data.totalItems-1);
          } else if (options.edgeReaction === 'reverse' && options.autoPlay !== 0) {
            // auto play is on, and set to go backwards once
            rotateCarousel(!direction,1);
            // reverse autoplay
            options.autoPlay *= -1;
          }
        // no edge hit, just move the carousel once
        } else {
          rotateCarousel(direction,1);
        }
      }

      /**
       * The event handler when an image within the carousel is clicked
       * This function will rotate the carousel the correct number of rotations
       * to get the clicked item to the center, or will fire the custom event
       * the user passed in if the center item is clicked
       */
      $(this).find('.carousel-images img').live("click", function () {
        // Remove autoplay
        autoPlay(true);
        options.autoPlay = 0;
        
        var itemPosition = $(this).data().currentPosition;
        var rotations = Math.abs(itemPosition);
        if (itemPosition < 0) {
          rotateCarousel(true, rotations);
        } else if (itemPosition > 0) {
          rotateCarousel(false, rotations);
        } else {
          options.clickedCenter($(this));
        }
      });

      /**
       * The user may choose to wrap the images is link tags. If they do this, we need to
       * make sure that they aren't active for certain situations
       */
      $(this).find('.carousel-images a').live("click", function (event) {
        var isCenter = ($(this).find('img').width() === $(this).find('img').data().owidth) ? true : false;
        // should we disable the links?
        if (options.linkHandling === 1 || // turn off all links
            (options.linkHandling === 2 && !isCenter)) // turn off all links except center
        {
          event.preventDefault();
          return false;
        }
      });

      /**
       * Event handlers for the optional carousel controls
       */
      $(this).find('.carousel-controls .carousel-prev').live('click',function (e) {
        moveOnce(true);
        e.preventDefault();
        return false;
      });
      $(this).find('.carousel-controls .carousel-next').live('click',function (e) {
        moveOnce(false);
        e.preventDefault();
        return false;
      });
      
      /**
       * Navigation with arrow keys
       */
      if (options.keyboardNav) {
        $(document).keydown(function(e) {
          if (e.which === 37 || e.which === 38) {
            // arrow left or up
            moveOnce(true);
          } else if (e.which === 39 || e.which === 40) {
            // arrow right or down
            moveOnce(false);
          }
          // should we override the normal functionality for the arrow keys?
          if (options.keyboardNavOverride && (e.which === 37 || e.which === 38 || e.which === 39 || e.which === 40)) {
            e.preventDefault();
            return false;
          }
        });
      }

    });
  };

  $.fn.waterwheelCarousel.defaults = {
    // number tweeks to change apperance
    startingItem:               0,      // item to place in the center at the start, set to zero to be the middle item
    startingItemSeparation:     150,    // the starting separation distance between each item
    itemSeparationFactor:       0.5,     // determines how drastically the item separation decreases
    startingWaveSeparation:     30,     // the starting separation distance for the wave
    waveSeparationFactor:       0.75,    // determines how drastically the wave separation decreases
    itemDecreaseFactor:         0.8,     // determines how drastically the item's width and height decrease
    opacityDecreaseFactor:      0.5,     // determines how drastically the item's opacity decreases
    centerOffset:               40,     // the number of pixels to offset the center item in the carousel
    flankingItems:              4,      // the number of items visible on either side of the center
    
    // animation
    speed:                      300,    // speed in milliseconds it will take to rotate from one to the next
    animationEasing:            'linear',// the animation easing when rotating each item
    quickerForFurther:          true,   // set to true to make animations faster when clicking an item that is far away from the center
    
    // misc
    linkHandling:               2,      // 1 to disable all (used for facebox), 2 to disable all but center (to link images out)
    autoPlay:                   0,      // indicate the speed in milliseconds to wait before autorotating. 0 to turn off. Can be negative
    orientation:                'horizontal', // indicate if the carousel should be horizontal or vertical
    activeClassName:            'active', // the name of the class given to the current item in the center
    keyboardNav:                false,  // set to true to move the carousel with the arrow keys
    keyboardNavOverride:        true,   // set to true to override the normal functionality of the arrow keys (prevents scrolling)
    edgeReaction:               'reset', // what does the carousel do when it reaches an edge? accepted: reset/reverse/nothing
    
    // callback functions
    movingToCenter:             $.noop, // fired when an item is about to move to the center position
    movedToCenter:              $.noop, // fired when an item has finished moving to the center
    clickedCenter:              $.noop, // fired when the center item has been clicked
    movingFromCenter:           $.noop, // fired when an item is about to leave the center position
    movedFromCenter:            $.noop  // fired when an item has finished moving from the center
  };

})(jQuery);
