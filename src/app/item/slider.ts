require("nativescript-dom");
import * as app from "@nativescript/core/application";
import * as Platform from "@nativescript/core/platform";
import * as utils from "@nativescript/core/utils/utils";
import { AbsoluteLayout } from "@nativescript/core/ui/layouts/absolute-layout";
import { StackLayout } from "@nativescript/core/ui/layouts/stack-layout";
import { View } from "@nativescript/core/ui/core/view";
import { Button } from "@nativescript/core/ui/button";
import { Label } from "@nativescript/core/ui/label";
import * as AnimationModule from "@nativescript/core/ui/animation";
import * as gestures from "@nativescript/core/ui/gestures";
import { AnimationCurve, Orientation } from "@nativescript/core/ui/enums";

declare const android: any;
declare const com: any;
declare const java: any;

// clases del slider
const SLIDE_INDICATOR_INACTIVE = "slide-indicator-inactive";
const SLIDE_INDICATOR_ACTIVE = "slide-indicator-active";
const SLIDE_INDICATOR_WRAP = "slide-indicator-wrap";
// layout params it seems only for android.
let LayoutParams: any;
if (app.android) {
    LayoutParams = <any>android.view.WindowManager.LayoutParams;
} else {
    LayoutParams = {};
}

export class Slide extends StackLayout {}

enum direction {
    none,
    left,
    right,
}

enum cancellationReason {
    user,
    noPrevSlides,
    noMoreSlides,
}

export interface ISlideMap {
    panel: StackLayout;
    index: number;
    left?: ISlideMap;
    right?: ISlideMap;
}

export class SlideContainer extends AbsoluteLayout {
    private currentPanel: ISlideMap;
    private transitioning: boolean = false;
    private direction: direction = direction.none;
    private _loaded: boolean;
    private _pageWidth: number;
    private _loop: boolean;
    private _pagerOffset: string;
    private _angular: boolean;
    private _disablePan: boolean;
    private _footer: StackLayout;
    private _pageIndicators: boolean;
    private _slideMap: ISlideMap[];
    private _slideWidth: string;
    private _shrinkSliderPercent = 100;
    private _gapBetweenSliders: number;
    private _eventCancelledByUser = false;
    private _twoOrMoreSlides = false;

    public static startEvent = "start";
    public static changedEvent = "changed";
    public static cancelledEvent = "cancelled";
    public static finishedEvent = "finished";

    /* page indicator stuff*/
    get pageIndicators(): boolean {
        return this._pageIndicators;
    }
    set pageIndicators(value: boolean) {
        if (typeof value === "string") {
            value = <any>value == "true";
        }
        this._pageIndicators = value;
    }

    get pagerOffset(): string {
        return this._pagerOffset;
    }
    set pagerOffset(value: string) {
        this._pagerOffset = value;
    }

    get hasNext(): boolean {
        return !!this.currentPanel && !!this.currentPanel.right;
    }
    get hasPrevious(): boolean {
        return !!this.currentPanel && !!this.currentPanel.left;
    }

    get shrinkSliderPercent(): number {
        return this._shrinkSliderPercent;
    }
    set shrinkSliderPercent(value: number) {
        if (value) {
            this._shrinkSliderPercent = value;
        } else {
            this._shrinkSliderPercent = 100;
        }
    }

    get gapBetweenSliders(): number {
        return this._gapBetweenSliders;
    }

    set gapBetweenSliders(value: number) {
        if (value) {
            this._gapBetweenSliders = value;
        } else {
            this._gapBetweenSliders = 0;
        }
    }

    get loop() {
        return this._loop;
    }

    set loop(value: boolean) {
        this._loop = value;
    }

    get disablePan() {
        return this._disablePan;
    }

    set disablePan(value: boolean) {
        if (this._disablePan === value) {
            return;
        } // Value did not change

        this._disablePan = value;
        if (this._loaded && this.currentPanel.panel !== undefined) {
            if (value === true) {
                this.currentPanel.panel.off("pan");
                if (
                    this.currentPanel.right &&
                    this.shrinkSliderPercent !== 100
                ) {
                    this.currentPanel.right.panel.off("pan");
                }
            } else if (value === false) {
                this.applySwipe(this.pageWidth);
            }
        }
    }

    get pageWidth() {
        if (!this.slideWidth) {
            return Platform.screen.mainScreen.widthDIPs;
        }
        return +this.slideWidth;
    }

    get angular(): boolean {
        return this._angular;
    }

    set angular(value: boolean) {
        this._angular = value;
    }

    get currentIndex(): number {
        return this.currentPanel.index;
    }

    get slideWidth(): string {
        return this._slideWidth;
    }
    set slideWidth(width: string) {
        this._slideWidth = width;
    }

    private get twoSliders() {
        return this.shrinkSliderPercent !== 100
            ? true
            : false && !!this.gapBetweenSliders;
    }

    constructor() {
        super();
        this.setupDefaultValues();
        // if being used in an ng2 app we want to prevent it from excuting the constructView
        // until it is called manually in ngAfterViewInit.

        this.constructView(true);
    }

    private setupDefaultValues(): void {
        this.clipToBounds = true;

        this._loaded = false;
        if (this._loop == null) {
            this.loop = false;
        }

        this.transitioning = false;

        if (this._disablePan == null) {
            this.disablePan = false;
        }

        if (this._angular == null) {
            this.angular = false;
        }

        if (this._pageIndicators == null) {
            this._pageIndicators = false;
        }

        if (this._pagerOffset == null) {
            this._pagerOffset = "88%"; //defaults to white.
        }
    }

    public constructView(constructor: boolean = false): void {
        this.on(AbsoluteLayout.loadedEvent, (data: any) => {
            //// console.log('LOADDED EVENT');
            if (!this._loaded) {
                this._loaded = true;
                if (this.angular === true && constructor === true) {
                    return;
                }

                let slides: StackLayout[] = [];

                if (!this.slideWidth) {
                    this.slideWidth = <any>this.pageWidth;
                }
                this.width = +this.slideWidth;

                // push each LayoutChild from SlideContainer i.e: Slide
                this.eachLayoutChild((view: View) => {
                    if (view instanceof Slide) {
                        // change heaig
                        AbsoluteLayout.setLeft(view, this.pageWidth);
                        view.width = this.pageWidth;
                        (<any>view).height = "100%"; //get around compiler
                        slides.push(view);
                    }
                });

                if (this.pageIndicators) {
                    this._footer = this.buildFooter(slides.length, 0);
                    this.setActivePageIndicator(0);
                    this.insertChild(this._footer, this.getChildrenCount());
                }

                this.currentPanel = this.buildSlideMap(slides);
                if (this.currentPanel) {
                    this.positionPanels(this.currentPanel);

                    if (this.disablePan === false) {
                        this.applySwipe(this.pageWidth);
                    }
                    if (app.ios) {
                        this.ios.clipsToBound = true;
                    }
                    //handles phone orientation change
                    app.on(
                        app.orientationChangedEvent,
                        (args: app.OrientationChangedEventData) => {
                            //event and page orientation didn't seem to alwasy be on the same page so setting it in the time out addresses this.
                            setTimeout(() => {
                                console.log("orientationChangedEvent");
                                this.width = parseInt(this.slideWidth);
                                this.eachLayoutChild((view: View) => {
                                    if (view instanceof StackLayout) {
                                        AbsoluteLayout.setLeft(
                                            view,
                                            this.pageWidth
                                        );
                                        view.width = this.pageWidth;
                                        // console.log(view.width, 'width')
                                    }
                                });

                                if (this.disablePan === false) {
                                    this.applySwipe(this.pageWidth);
                                }

                                if (this.pageIndicators) {
                                    AbsoluteLayout.setTop(this._footer, 0);
                                    var pageIndicatorsLeftOffset =
                                        this.pageWidth / 4;
                                    AbsoluteLayout.setLeft(
                                        this._footer,
                                        pageIndicatorsLeftOffset
                                    );
                                    this._footer.width = this.pageWidth / 2;
                                    this._footer.marginTop = <any>(
                                        this._pagerOffset
                                    );
                                }

                                this.positionPanels(this.currentPanel);
                            }, 0);
                        }
                    );
                }
            }
        });
    }

    public nextSlide(): void {
        if (!this.hasNext) {
            this.triggerCancelEvent(cancellationReason.noMoreSlides);
            return;
        }

        this.direction = direction.left;
        this.transitioning = true;
        this.triggerStartEvent();
        this.showRightSlide(this._slideMap).then(() => {
            this.setupPanel(this.currentPanel.right);
            this.triggerChangeEventRightToLeft();
        });
    }
    public previousSlide(): void {
        if (!this.hasPrevious) {
            this.triggerCancelEvent(cancellationReason.noPrevSlides);
            return;
        }

        this.direction = direction.right;
        this.transitioning = true;
        this.triggerStartEvent();
        this.showLeftSlide(this._slideMap).then(() => {
            this.setupPanel(this.currentPanel.left);
            this.triggerChangeEventLeftToRight();
        });
    }

    private setupPanel(panel: ISlideMap) {
        this.direction = direction.none;
        this.transitioning = false;
        this.currentPanel.panel.off("pan");
        this.currentPanel = panel;

        // sets up each panel so that they are positioned to transition either way.
        this.positionPanels(this.currentPanel);

        if (this.disablePan === false) {
            this.applySwipe(this.pageWidth);
        }

        if (this.pageIndicators) {
            this.setActivePageIndicator(this.currentPanel.index);
        }
    }

    private positionPanels(panel: ISlideMap) {
        console.log("entro position panels", panel.index);
        // sets up each panel so that they are positioned to transition either way.
        let panelLeftGap = 0;
        let addPercentage = 0;
        if (this.shrinkSliderPercent !== 100) {
            panel.panel.width = (this.pageWidth / 100) * this.shrinkSliderPercent;
            if (
                this._slideMap[this._slideMap.length - 1].index === panel.index
            ) {

                // align right when is last slide
                addPercentage =
                    (this.pageWidth / 100) *
                    (100 - this.shrinkSliderPercent + this.gapBetweenSliders);

                if (panel.left !== null) {
                    panelLeftGap =
                        (this.pageWidth / 100) *
                        ((100 - this.shrinkSliderPercent) * 2);
                } else {
                    panelLeftGap = 0;
                }
            }

            if(app.ios) {
                if(this._slideMap[this.currentIndex+1].right) {
                    this._slideMap[this.currentIndex+1].right.panel.translateX = 0;
                }
            }
        }
        console.log('addPercentage ', addPercentage, panel.index)
        panel.panel.translateX = -this.pageWidth + addPercentage;
        if (panel.left != null) {
            console.log(panel.left.panel.width, "width del panel");
            panel.left.panel.translateX = -this.pageWidth * 2 + panelLeftGap
        }
        if (panel.right != null) {
            panel.right.panel.translateX =
                this.shrinkSliderPercent !== 100
                    ? -(
                          (this.pageWidth / 100) *
                          (100 -
                              this.shrinkSliderPercent -
                              this._gapBetweenSliders)
                      )
                    : 0;
        }

    }

    public goToSlide(index: number): void {
        if (
            this._slideMap &&
            this._slideMap.length > 0 &&
            index < this._slideMap.length
        ) {
            let previousSlide = this.currentPanel;

            this.setupPanel(this._slideMap[index]);

            this.notify({
                eventName: SlideContainer.changedEvent,
                object: this,
                eventData: {
                    direction: direction.none,
                    newIndex: this.currentPanel.index,
                    oldIndex: previousSlide.index,
                },
            });
        } else {
            // console.log('invalid index');
        }
    }

    public applySwipe(pageWidth: number): void {
        let previousDelta = -1; //hack to get around ios firing pan event after release
        let endingVelocity = 0;
        let startTime, deltaTime;
        const panTrigger = this.twoSliders ? 5 : 3;

        this.currentPanel.panel.on(
            "pan",
            (args: gestures.PanGestureEventData): void => {
                if (args.state === gestures.GestureStateTypes.began) {
                    startTime = Date.now();
                    previousDelta = 0;
                    endingVelocity = 250;

                    this.triggerStartEvent(); // notify to custom events
                } else if (args.state === gestures.GestureStateTypes.ended) {
                    console.log("Termino el gesto");
                    // when pan endend save time of delta.
                    deltaTime = Date.now() - startTime;
                    // if velocityScrolling is enabled then calculate the velocitty

                    // swiping left to right.
                    // if deltaX is a 3th part of pan.
                    if (args.deltaX > pageWidth / panTrigger) {
                        if (this.hasPrevious) {
                            // left to right +x
                            this.transitioning = true;
                            this.showLeftSlide(
                                // apply animation
                                this._slideMap,
                                args.deltaX,
                                endingVelocity
                            ).then(() => {
                                this.setupPanel(this.currentPanel.left);

                                this.triggerChangeEventLeftToRight();
                            });
                        } else {
                            //We're at the start
                            //Notify no more slides
                            this.triggerCancelEvent(
                                cancellationReason.noPrevSlides
                            );
                        }
                        return;
                        // swiping right to left -x
                    } else if (args.deltaX < -pageWidth / panTrigger) {
                        this.doSwipeRightToLeft(
                            args,
                            pageWidth,
                            panTrigger,
                            endingVelocity,
                            this.currentPanel.right
                        );
                        return;
                    }
                    // user has cancelled transition
                    if (
                        !(args.deltaX < -pageWidth - 1 / panTrigger) ||
                        !(args.deltaX > pageWidth - 1 / panTrigger)
                    ) {
                        console.log("entro userCancelled");
                        //Notify cancelled
                        this.triggerCancelEvent(cancellationReason.user);
                        this.transitioning = true;

                        let panelLeftGap = 0;
                        let addPercentage = 0;
                        if (this.shrinkSliderPercent !== 100) {
                            this.currentPanel.panel.width = (this.pageWidth / 100) * this.shrinkSliderPercent;
                            if (
                                this._slideMap[this._slideMap.length - 1].index === this.currentPanel.index
                            ) {

                                // align right when is last slide
                                addPercentage =
                                    (this.pageWidth / 100) *
                                    (100 - this.shrinkSliderPercent + this.gapBetweenSliders);

                                if (this.currentPanel.left !== null) {
                                    panelLeftGap =
                                        (this.pageWidth / 100) *
                                        ((100 - this.shrinkSliderPercent) * 2);
                                } else {
                                    panelLeftGap = 0;
                                }
                            }
                        }
                        this.currentPanel.panel.animate({
                            translate: { x: -this.pageWidth + addPercentage, y: 0 },
                            duration: 200,
                            curve: AnimationCurve.easeOut,
                        });
                         if (this.hasNext) {

                            console.log("entro hasNext userCancelled");
                            let translateX = 0;
                            if (this.shrinkSliderPercent !== 100) {
                                translateX =
                                    (-this.pageWidth / 100) *
                                    (100 -
                                        this.shrinkSliderPercent -
                                        this.gapBetweenSliders);
                            } else {
                                translateX = 0;
                            }
                            this.currentPanel.right.panel.animate({
                                translate: { x: translateX +panelLeftGap, y: 0 },
                                duration: 200,
                                curve: AnimationCurve.easeOut,
                            });
                         if (app.ios) {
                                 this.currentPanel.right.panel.translateX = 0;
                            }
                            //for some reason i have to set these in ios or there is some sort of bounce back.
                        }
                        if (this.hasPrevious) {
                            console.log("entro hasPrevious userCancelled");

                            this.currentPanel.left.panel.animate({
                                translate: { x:  -this.pageWidth * 2 + panelLeftGap, y: 0 },
                                duration: 200,
                                curve: AnimationCurve.easeOut,
                            });


                            // if (app.ios) {
                            //     this.currentPanel.left.panel.translateX =
                            //         -this.pageWidth * 2 +panelLeftGap;
                            // }
                        }
                        // if (app.ios) {
                        //     this.currentPanel.panel.translateX =
                        //         -this.pageWidth;
                        //     this.transitioning = false;
                        // }
                       // if (this.shrinkSliderPercent !== 100) {
                            console.log('∂panel id', this.currentPanel.index)
                            this.setupPanel(this.currentPanel);
                       // }
                    }
                } else {
                    // delta to left -x
                    if (
                        // !this.transitioning &&
                        previousDelta !== args.deltaX &&
                        args.deltaX != null &&
                        args.deltaX < 0
                    ) {
                        this.deltaXNegative(args);
                        return;
                    } else if (
                        //   !this.transitioning &&
                        previousDelta !== args.deltaX &&
                        args.deltaX != null &&
                        args.deltaX > 0
                    ) {
                        this.deltaXPositiveX(args);
                        return;
                    }

                    if (args.deltaX !== 0) {
                        previousDelta = args.deltaX;
                    }
                }
            }
        );
        if (this.currentPanel.right && this.shrinkSliderPercent !== 100) {
            this.currentPanel.right.panel.on(
                "pan",
                (args: gestures.PanGestureEventData): void => {
                    console.log("pan left", args.deltaX);
                    if (args.state === gestures.GestureStateTypes.began) {
                    } else if (
                        args.state === gestures.GestureStateTypes.ended
                    ) {
                        // right to left

                        if (args.deltaX < -pageWidth / panTrigger) {
                            this.doSwipeRightToLeft(
                                args,
                                pageWidth,
                                panTrigger,
                                endingVelocity,
                                this.currentPanel.right
                            );
                            return;
                        } else if (
                            !(args.deltaX < -pageWidth - 1 / panTrigger) ||
                            !(args.deltaX > pageWidth - 1 / panTrigger)
                        ) {
                            console.log("entro userCancelled");
                            //Notify cancelled
                            this.triggerCancelEvent(cancellationReason.user);
                            this.transitioning = true;
                            this.currentPanel.panel.animate({
                                translate: { x: -this.pageWidth, y: 0 },
                                duration: 200,
                                curve: AnimationCurve.easeOut,
                            });
                            if (this.hasNext) {
                                console.log("entro hasNext userCancelled");
                                let translateX;
                                if (this.shrinkSliderPercent !== 100) {
                                    translateX =
                                        (-this.pageWidth / 100) *
                                        (100 -
                                            this.shrinkSliderPercent -
                                            this.gapBetweenSliders);
                                } else {
                                    translateX = 0;
                                }
                                this.currentPanel.right.panel.animate({
                                    translate: { x: translateX, y: 0 },
                                    duration: 200,
                                    curve: AnimationCurve.easeOut,
                                });
                                if (app.ios) {
                                    this.currentPanel.right.panel.translateX = 0;
                                }

                                //for some reason i have to set these in ios or there is some sort of bounce back.
                            }
                        }
                    } else {
                        if (
                            // !this.transitioning &&
                            previousDelta !== args.deltaX &&
                            args.deltaX != null &&
                            args.deltaX < 0
                        ) {
                            return;
                            this.deltaXNegative(args);
                        }
                    }
                }
            );
        }
    }

    private doSwipeRightToLeft(
        args: gestures.PanGestureEventData,
        pageWidth,
        panTrigger,
        endingVelocity,
        currentPanel: ISlideMap
    ) {
        if (this.hasNext) {
            // transition to +x right to left finished
            this.transitioning = true;
            this.showRightSlide(
                this._slideMap,
                args.deltaX,
                endingVelocity
            ).then(() => {
                console.log('setupPanel')
                this.setupPanel(currentPanel);

                // Notify changed
                this.triggerChangeEventRightToLeft();

                if (!this.hasNext) {
                    // Notify finsihed
                    this.notify({
                        eventName: SlideContainer.finishedEvent,
                        object: this,
                    });
                }
            });
        } else {
            // We're at the end
            // Notify no more slides
            this.triggerCancelEvent(cancellationReason.noMoreSlides);
        }
    }

    private deltaXNegative(args: gestures.PanGestureEventData) {
        console.log("X negative left ");
        if (this.hasNext) {
            this.direction = direction.left;
            if (
                this._slideMap[this._slideMap.length - 1].index ===
                this.currentPanel.index
            ) {
            } else {
                this.currentPanel.panel.translateX =
                    args.deltaX - this.pageWidth;
            }
            let translateRightInX;
            if (this.shrinkSliderPercent !== 100) {
                this._twoOrMoreSlides = true;
                translateRightInX =
                    (-this.pageWidth / 100) *
                    (100 - this.shrinkSliderPercent - this.gapBetweenSliders);
                this.currentPanel.right.panel.width =
                    (this.pageWidth / 100) * this.shrinkSliderPercent -
                    this._gapBetweenSliders;

                if (this.currentPanel.left) {
                    this.currentPanel.left.panel.translateX =
                        -this.pageWidth * 2;
                }
                console.log(
                    "panel right width ",
                    this.currentPanel.right.panel.width
                );
            } else {
                translateRightInX = 0;
            }
            this.currentPanel.right.panel.translateX =
                args.deltaX + translateRightInX;
        }
        return;
        // delta to right +x
    }

    private deltaXPositiveX(args: gestures.PanGestureEventData) {
        if (this.hasPrevious) {
            console.log("x Positive right");
            console.log(args.deltaX, "delta in unknow second");

            let addGapRightToLeft;
            let addGapLeftSlide;
            if (this.shrinkSliderPercent !== 100) {
                addGapRightToLeft =
                    (this.shrinkSliderPercent / 100) * this.shrinkSliderPercent;
                addGapLeftSlide = -this.pageWidth * 2 + this.pageWidth / 100 * (100- this.shrinkSliderPercent - this.gapBetweenSliders * 2) * 2;
                 if (this.currentPanel.right) {
                    this.currentPanel.right.panel.translateX = args.deltaX;
                 }
            } else {
                addGapLeftSlide = 0;
                addGapRightToLeft = 0;
            }

            this.direction = direction.right;
            this.currentPanel.panel.translateX =
                args.deltaX - this.pageWidth + addGapRightToLeft;

            if (this.shrinkSliderPercent !== 100) {
                this.currentPanel.left.panel.translateX =
                    args.deltaX + addGapLeftSlide;
                console.log(
                    "deltaX",
                    args.deltaX,
                    "addGapLeftSide",
                    addGapLeftSlide
                );

            } else {
                this.currentPanel.left.panel.translateX =
                    -this.pageWidth * 2 + args.deltaX;
            }

             if (app.ios) {
                this.currentPanel.right.panel.translateX = 0;
           }

        }

    }
    // do animation -x
    private showRightSlide(
        panelMap: ISlideMap[],
        offset: number = this.pageWidth,
        endingVelocity: number = 32
    ): AnimationModule.AnimationPromise {
        let animationDuration: number;
        animationDuration = 300; // default value

        let transition = new Array();
        let addPercentage = 0;
        let gapPrevSlide = 0;
        if (this.shrinkSliderPercent !== 100) {
                    // show a bit of last panel at end
            if (
                panelMap[this._slideMap.length - 2].index ===
                panelMap[this.currentIndex].index
            ) {
                addPercentage =
                    (this.pageWidth / 100) *
                    (100 - this.shrinkSliderPercent + this.gapBetweenSliders);
                gapPrevSlide =
                    (this.pageWidth / 100) *
                    ((100 - this.shrinkSliderPercent) * 2);
            } else {
                addPercentage = 0;
                gapPrevSlide = 0;
            }
        }
        //console.log(-this.pageWidth * 2, 'aqui');
        //hide current panel or show a bit
        transition.push({
            target: panelMap[this.currentIndex].panel,
            translate: { x: -this.pageWidth * 2 + gapPrevSlide, y: 0 },
            duration: animationDuration,
            curve: AnimationCurve.easeOut,
        });
        console.log(
            "current panel en este momento",
            panelMap[this.currentIndex].panel.width
        );
        // show next panel

        console.log('addPercentage showRightSlide',addPercentage);



        if (this.shrinkSliderPercent !== 100) {
            // show a bit of next panel
            panelMap[this.currentIndex].right.panel.width =
                (this.pageWidth / 100) * this.shrinkSliderPercent;
            if (panelMap[this.currentIndex + 1].right) {
                transition.push({
                    target: panelMap[this.currentIndex + 1].right.panel,
                    translate: {
                        x:
                            -(this.pageWidth / 100) *
                            (100 -
                                this.shrinkSliderPercent -
                                this._gapBetweenSliders),
                        y: 0,
                    },
                    duration: animationDuration,
                    curve: AnimationCurve.easeOut,
                });
            }
        }
        transition.push({
            target: panelMap[this.currentIndex].right.panel,
            translate: { x: -this.pageWidth + addPercentage, y: 0 },
            duration: animationDuration,
            curve: AnimationCurve.easeOut,
        });





        let animationSet = new AnimationModule.Animation(transition, false);

        return animationSet.play();
    }
    // do animation right +x
    private showLeftSlide(
        panelMap: ISlideMap[],
        offset: number = this.pageWidth,
        endingVelocity: number = 32
    ): AnimationModule.AnimationPromise {
        let animationDuration: number;
        animationDuration = 300; // default value
        let transition = new Array();
        // show next panel
        //-(this.pageWidth / 100 * (100 - this.shrinkSliderPercent - 10))
        if (this.shrinkSliderPercent !== 100) {
            panelMap[this.currentIndex].left.panel.width =
                (this.pageWidth / 100) * this.shrinkSliderPercent;
            if (panelMap[this.currentIndex].panel) {
                transition.push({
                    target: panelMap[this.currentIndex].panel,
                    translate: {
                        x:
                            -(this.pageWidth / 100) *
                            (100 -
                                this.shrinkSliderPercent -
                                this._gapBetweenSliders),
                        y: 0,
                    },
                    duration: animationDuration,
                    curve: AnimationCurve.easeOut,
                });
            }


            if(this._slideMap[this.currentIndex].right){
                transition.push({
                    target: panelMap[this.currentIndex].right.panel,
                    translate: { x: 0, y: 0 },
                    duration: animationDuration,
                    curve: AnimationCurve.easeOut,
                });

                if(app.ios) {
                    panelMap[this.currentIndex].right.panel.translateX = 0;
                }

        }




            // hi
        }
        transition.push({
            target: panelMap[this.currentIndex].left.panel,
            translate: { x: -this.pageWidth, y: 0 },
            duration: animationDuration,
            curve: AnimationCurve.easeOut,
        });
        // hide current panel animation
        if (!this._twoOrMoreSlides) {
            transition.push({
                target: panelMap[this.currentIndex].panel,
                translate: { x: 0, y: 0 },
                duration: animationDuration,
                curve: AnimationCurve.easeOut,
            });
        }

        let animationSet = new AnimationModule.Animation(transition, false);

        return animationSet.play();
    }

    private buildFooter(
        pageCount: number = 5,
        activeIndex: number = 0
    ): StackLayout {
        let footerInnerWrap = new StackLayout();

        //footerInnerWrap.height = 50;
        if (app.ios) {
            footerInnerWrap.clipToBounds = false;
        }
        footerInnerWrap.className = SLIDE_INDICATOR_WRAP;

        AbsoluteLayout.setTop(footerInnerWrap, 0);

        footerInnerWrap.orientation = "horizontal";
        footerInnerWrap.horizontalAlignment = "center";
        footerInnerWrap.width = this.pageWidth / 2;

        let index = 0;
        while (index < pageCount) {
            footerInnerWrap.addChild(this.createIndicator(index));
            index++;
        }

        let pageIndicatorsLeftOffset = this.pageWidth / 4;

        AbsoluteLayout.setLeft(footerInnerWrap, pageIndicatorsLeftOffset);
        footerInnerWrap.marginTop = <any>this._pagerOffset;

        return footerInnerWrap;
    }

    private setwidthPercent(view: View, percentage: number) {
        (<any>view).width = percentage + "%";
    }

    private newFooterButton(name: string): Button {
        let button = new Button();
        button.id = "btn-info-" + name.toLowerCase();
        button.text = name;
        this.setwidthPercent(button, 100);
        return button;
    }

    private buildSlideMap(views: StackLayout[]) {
        this._slideMap = [];
        views.forEach((view: StackLayout, index: number) => {
            // console.log(views);
            this._slideMap.push({
                panel: view,
                index: index,
            });
        });
        this._slideMap.forEach((mapping: ISlideMap, index: number) => {
            if (this._slideMap[index - 1] != null) {
                mapping.left = this._slideMap[index - 1];
            }
            if (this._slideMap[index + 1] != null) {
                mapping.right = this._slideMap[index + 1];
            }
        });

        if (this.loop === true) {
            this._slideMap[0].left = this._slideMap[this._slideMap.length - 1];
            this._slideMap[this._slideMap.length - 1].right = this._slideMap[0];
        }
        return this._slideMap[0];
    }

    private triggerStartEvent() {
        this.notify({
            eventName: SlideContainer.startEvent,
            object: this,
            eventData: {
                currentIndex: this.currentPanel.index,
            },
        });
    }

    private triggerChangeEventLeftToRight() {
        this.notify({
            eventName: SlideContainer.changedEvent,
            object: this,
            eventData: {
                direction: direction.left,
                newIndex: this.currentPanel.index,
                oldIndex: this.currentPanel.index + 1,
            },
        });
    }

    private triggerChangeEventRightToLeft() {
        this.notify({
            eventName: SlideContainer.changedEvent,
            object: this,
            eventData: {
                direction: direction.right,
                newIndex: this.currentPanel.index,
                oldIndex: this.currentPanel.index - 1,
            },
        });
    }

    private triggerCancelEvent(cancelReason: cancellationReason) {
        this.notify({
            eventName: SlideContainer.cancelledEvent,
            object: this,
            eventData: {
                currentIndex: this.currentPanel.index,
                reason: cancelReason,
            },
        });
    }

    createIndicator(index: number): Label {
        let indicator = new Label();

        (<any>indicator).classList.add(SLIDE_INDICATOR_INACTIVE);
        return indicator;
    }

    setActivePageIndicator(index: number) {
        let indicatorsToDeactivate = (<any>this._footer).getElementsByClassName(
            SLIDE_INDICATOR_ACTIVE
        );

        indicatorsToDeactivate.forEach((activeIndicator) => {
            activeIndicator.classList.remove(SLIDE_INDICATOR_ACTIVE);
            activeIndicator.classList.add(SLIDE_INDICATOR_INACTIVE);
        });

        let activeIndicator = (<any>this._footer).getElementsByClassName(
            SLIDE_INDICATOR_INACTIVE
        )[index];
        if (activeIndicator) {
            activeIndicator.classList.remove(SLIDE_INDICATOR_INACTIVE);
            activeIndicator.classList.add(SLIDE_INDICATOR_ACTIVE);
        }
    }

    iosProperty(theClass, theProperty) {
        if (typeof theProperty === "function") {
            // xCode 7 and below
            return theProperty.call(theClass);
        } else {
            // xCode 8+
            return theProperty;
        }
    }
}
