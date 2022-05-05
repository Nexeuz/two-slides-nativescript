import { Component, ElementRef, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { registerElement } from "@nativescript/angular";
import { StackLayout } from "ui/layouts/stack-layout";
import { GridLayout } from "ui/layouts/grid-layout";
import { Label } from "tns-core-modules/ui/label";
import { Image as Img } from "tns-core-modules/ui/image";
import { ItemService } from "./item.service";
import { Slide, SlideContainer } from "./slider";
import { Page } from "@nativescript/core/ui";
registerElement("Slide", () => Slide);
registerElement("SlideContainer", () => SlideContainer);

@Component({
    selector: "ns-items",
    templateUrl: "./items.component.html",
})
export class ItemsComponent implements OnInit {
    slides;
    isReady = false;

    constructor(
        private route: ActivatedRoute,
        private _page: Page,
        private itemService: ItemService
    ) {}

    ngOnInit() {}
    ngAfterViewInit() {
        setTimeout(() => {
            this.buildSlider();

        },1000)
    }

    buildSlider() {
       const layoutPlaceHolder = <GridLayout>this._page.getViewById("slide-container");
        let slideContainer = new SlideContainer();
        slideContainer.row = 0;
        slideContainer.col = 0;
        slideContainer.pagerOffset = '35%';
        slideContainer.pageIndicators = true;
        slideContainer.shrinkSliderPercent = 70;
        slideContainer.gapBetweenSliders = 7;
        slideContainer.addChild(
            this.buildSliders(
                "res://icon",
                "Google",
                "aEl mayor buscador del mundo",
                "slide-1",
                "orange"
            )
        );

        slideContainer.addChild(
            this.buildSliders(
                "res://icon",
                "Google",
                "eEl mayor buscador del mundo 1",
                "slide-2",
                "blue"

            )
        );

        slideContainer.addChild(
            this.buildSliders(
                "res://icon",
                "Google",
                "iEl mayor buscador del mundo 2",
                "slide-2",
                "purple"
            )
        );
        slideContainer.addChild(
            this.buildSliders(
                "res://icon",
                "Google",
                "iEl mayor buscador del mundo 2",
                "slide-2",
                "brown"
            )
        );
        slideContainer.addChild(
            this.buildSliders(
                "res://icon",
                "Google",
                "iEl mayor buscador del mundo 2",
                "slide-2",
                "gray"
            )
        );
        slideContainer.addChild(
            this.buildSliders(
                "res://icon",
                "Google",
                "iEl mayor buscador del mundo 2",
                "slide-2",
                "white"
            )
        );
        slideContainer.addChild(
            this.buildSliders(
                "res://icon",
                "Google",
                "iEl mayor buscador del mundo 2",
                "slide-2",
                "red"
            )
        );

    slideContainer.addChild(
            this.buildSliders(
                "res://icon",
                "Google",
                "iEl mayor buscador del mundo 2",
                "slide-2",
                "green"
            )
        );



        layoutPlaceHolder.addChild(slideContainer);
    }

    buildSliders(
        imgURL: string,
        title: string,
        description: string,
        className: string,
        backgroundColor: string
    ): Slide {
        const card = new StackLayout();
        card.width = 'auto';
        let slide = new Slide();
        slide.backgroundColor = 'gray'
        slide.className = className;
        let label = new Label();
        label.text = description;
        label.backgroundColor = 'yellow';
        // label.backgroundColor ="yellow"

        let image = new Img();
        image.src = imgURL;
        image.width = 100;
        console.log(imgURL);
       // card.backgroundColor = 'orange';
        card.paddingTop = 10
        card.backgroundColor = backgroundColor;
        card.borderWidth = 1;
        card.borderColor = 'purple'
        card.addChild(label);
        card.addChild(image);

        // card.addChild(label)
        slide.addChild(card);

        return slide;
    }


    onSlideChanged({ eventData }): void {
        console.log(eventData);
    }
}
